<?php
/**
 * Eject — make a page independent of this plugin.
 *
 * kit/* blocks are dynamic: with the plugin gone WordPress renders only their children, so the band/grid
 * wrappers (and every compiled layout rule) vanish. Eject rewrites ONE post so it keeps the same layout with
 * the plugin deactivated or deleted:
 *   1. post_content: kit/band|split|cell -> core/group wrappers carrying the same class hooks (.kit-band,
 *      .kit-band__inner, .kit-split, .kit-cell, .kc-N); every layout/colour/spacing/typography attr is dropped
 *      from the block (it is baked, not attached) so the core/group markup is the plain save() shape.
 *   2. the compiled per-instance CSS + the static base rules are baked into the active theme's Additional CSS
 *      (core's `custom_css` post) between per-post markers — core prints it on every theme, with or without
 *      any plugin, and no file on disk is written (works under DISALLOW_FILE_MODS).
 * Reversible: the original post_content is stored as a before-image in post meta; revert restores it and
 * removes the post's CSS section. Refuses (never half-ejects) on content it cannot convert faithfully:
 * kit/countdown (live JS), synced patterns that contain kit blocks.
 *
 * REST (namespace vibery-blocks/v1, alias md-content/v1/blocks/*; auth = WP application password; caps: edit_post on the post + edit_css + edit_theme_options):
 *   GET  /status?post_id=      { version, post:{ ejected, kit_blocks, stylesheet } }
 *   POST /eject                { post_id, dry_run? }  -> { status, converted{}, css_bytes, stylesheet, rev }
 *   POST /eject/revert         { post_id, force? }    -> { status, rev }
 */

defined( 'ABSPATH' ) || exit;

final class Vibery_Blocks_Eject {
	const NS       = 'vibery-blocks/v1';
	const META     = '_vibery_blocks_eject';
	const MAX_CSS  = 524288; // 512 KiB per post; Additional CSS is a DB field, not a file.
	const GROUP_TAGS = array( 'div', 'section', 'header', 'footer', 'aside', 'main', 'article' );

	/** Canonical namespace vibery-blocks/v1, plus an alias under md-content/v1 (/blocks/*): Site Manager reaches a
	 *  connected site through the Vibery Connect plugin's namespace only, so the alias is how `build_eject` gets
	 *  here without Site Manager learning a second REST namespace. Same callbacks, same capability checks. */
	public static function register_routes() {
		$post_arg = array( 'post_id' => array( 'type' => 'integer', 'required' => true, 'minimum' => 1 ) );
		foreach ( array( self::NS => '', 'md-content/v1' => '/blocks' ) as $ns => $prefix ) {
			register_rest_route( $ns, $prefix . '/status', array(
				'methods'             => 'GET',
				'callback'            => array( __CLASS__, 'handle_status' ),
				'permission_callback' => function () { return current_user_can( 'edit_posts' ); },
			) );
			register_rest_route( $ns, $prefix . '/eject', array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'handle_eject' ),
				'permission_callback' => array( __CLASS__, 'can_eject' ),
				'args'                => $post_arg + array( 'dry_run' => array( 'type' => 'boolean', 'default' => false ) ),
			) );
			register_rest_route( $ns, $prefix . '/eject/revert', array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'handle_revert' ),
				'permission_callback' => array( __CLASS__, 'can_eject' ),
				'args'                => $post_arg + array( 'force' => array( 'type' => 'boolean', 'default' => false ) ),
			) );
		}
	}

	public static function can_eject( $request ) {
		$id = (int) $request->get_param( 'post_id' );
		if ( $id > 0 && ! get_post( $id ) ) {
			return current_user_can( 'edit_posts' ); // let the handler answer 404 instead of a misleading 403
		}
		// Additional CSS is theme-wide: core maps edit_css to unfiltered_html (which Editors have), so also
		// require edit_theme_options — only people who can already restyle the whole site may bake rules into it.
		return $id > 0 && current_user_can( 'edit_post', $id ) && current_user_can( 'edit_css' ) && current_user_can( 'edit_theme_options' );
	}

	/* ---------------------------------------------------------------------------------------------------
	 * conversion
	 * ------------------------------------------------------------------------------------------------- */

	private static function classes( $attrs, array $own ) {
		$extra = isset( $attrs['className'] ) && is_string( $attrs['className'] ) ? $attrs['className'] : '';
		$extra = preg_match( '/^[A-Za-z0-9_\- ]*$/', $extra ) ? $extra : '';
		$uid   = isset( $attrs['uniqueId'] ) && preg_match( '/^kc-\d+$/', (string) $attrs['uniqueId'] ) ? $attrs['uniqueId'] : '';
		$all   = array_filter( array_merge( $own, array( $uid ), preg_split( '/\s+/', trim( $extra ) ) ) );
		return array_values( array_unique( $all ) );
	}

	/** A parsed core/group block as WP's own save() would serialize it for these attrs + children. */
	private static function group( array $attrs, array $classes, $tag, array $children ) {
		$gattrs = array();
		if ( 'div' !== $tag ) { $gattrs['tagName'] = $tag; }
		$gattrs['className'] = implode( ' ', array_diff( $classes, array( 'wp-block-group' ) ) );
		$id = '';
		if ( ! empty( $attrs['anchor'] ) && preg_match( '/^[A-Za-z][A-Za-z0-9_:.\-]*$/', (string) $attrs['anchor'] ) ) {
			$gattrs['anchor'] = $attrs['anchor'];
			$id = ' id="' . esc_attr( $attrs['anchor'] ) . '"';
		}
		$open  = '<' . $tag . $id . ' class="wp-block-group ' . esc_attr( $gattrs['className'] ) . '">';
		$close = '</' . $tag . '>';
		$inner = array( $open );
		foreach ( $children as $i => $_ ) {
			if ( $i > 0 ) { $inner[] = "\n\n"; }
			$inner[] = null;
		}
		$inner[] = $close;
		return array(
			'blockName'    => 'core/group',
			'attrs'        => $gattrs,
			'innerBlocks'  => $children,
			'innerHTML'    => $open . $close,
			'innerContent' => $inner,
		);
	}

	/** Recursively convert; returns the new block list. $rep collects counts + unsupported reasons. */
	public static function convert( array $blocks, array &$rep ) {
		$out = array();
		foreach ( $blocks as $b ) {
			$name  = isset( $b['blockName'] ) ? (string) $b['blockName'] : '';
			$attrs = isset( $b['attrs'] ) && is_array( $b['attrs'] ) ? $b['attrs'] : array();
			$kids  = ! empty( $b['innerBlocks'] ) ? self::convert( $b['innerBlocks'], $rep ) : array();
			if ( 'kit/countdown' === $name ) {
				$rep['unsupported'][] = array( 'block' => $name, 'reason' => 'live_script', 'detail' => 'countdown ticks via viewScript; it cannot survive plugin removal' );
				$out[] = $b;
				continue;
			}
			if ( 'core/block' === $name && ! empty( $attrs['ref'] ) ) {
				$ref = get_post( (int) $attrs['ref'] );
				if ( $ref && false !== strpos( $ref->post_content, '<!-- wp:kit/' ) ) {
					$rep['unsupported'][] = array( 'block' => $name, 'reason' => 'synced_pattern', 'detail' => 'pattern #' . (int) $attrs['ref'] . ' contains kit blocks' );
				}
			}
			if ( 'kit/band' === $name ) {
				$tag = isset( $attrs['tagName'] ) && in_array( $attrs['tagName'], self::GROUP_TAGS, true ) ? $attrs['tagName'] : 'section';
				$inner = self::group( array(), array( 'kit-band__inner' ), 'div', $kids );
				$out[] = self::group( $attrs, self::classes( $attrs, array( 'kit-band' ) ), $tag, array( $inner ) );
				$rep['converted']['kit/band'] = ( $rep['converted']['kit/band'] ?? 0 ) + 1;
			} elseif ( 'kit/split' === $name ) {
				$at = isset( $attrs['stackAt'] ) ? (string) $attrs['stackAt'] : '782px';
				if ( '' === $at ) { $sc = 'kit-split--nostack'; }
				elseif ( preg_match( '/^(\d+)px$/', $at, $m ) ) { $sc = 'kit-split--stack-' . $m[1]; }
				else { $sc = 'kit-split--stack-782'; }
				if ( ! empty( $attrs['wrap'] ) ) { $sc = 'kit-split--wrap'; }
				if ( in_array( $attrs['tagName'] ?? 'div', array( 'ul', 'ol' ), true ) ) {
					// core/group cannot be a <ul>: the grid survives, the list semantics do not (declared, not hidden)
					$rep['warnings'][] = 'list_semantics_lost';
				}
				$out[] = self::group( $attrs, self::classes( $attrs, array( 'kit-split', $sc ) ), 'div', $kids );
				$rep['converted']['kit/split'] = ( $rep['converted']['kit/split'] ?? 0 ) + 1;
			} elseif ( 'kit/layer' === $name ) {
				// position/size/z live in the baked kc rule; aria-hidden of a decorative layer is lost with the
				// plugin (core/group has no aria attribute) — it holds no text, so nothing is announced anyway.
				$out[] = self::group( $attrs, self::classes( $attrs, array( 'kit-layer' ) ), 'div', $kids );
				$rep['converted']['kit/layer'] = ( $rep['converted']['kit/layer'] ?? 0 ) + 1;
			} elseif ( 'kit/cell' === $name ) {
				$own = array( 'kit-cell' );
				if ( ( $attrs['type'] ?? '' ) === 'cover-image' ) { $own[] = 'kit-cell--cover'; }
				if ( ! empty( $attrs['justify'] ) ) { $own[] = 'kit-cell--flex'; }
				$out[] = self::group( $attrs, self::classes( $attrs, $own ), 'div', $kids );
				$rep['converted']['kit/cell'] = ( $rep['converted']['kit/cell'] ?? 0 ) + 1;
			} else {
				$b['innerBlocks'] = $kids;
				$out[] = $b;
			}
		}
		return $out;
	}

	/** Preset-slug attrs the compiler leaves to core's wrapper-class support; baked here as declarations. */
	private static function extra_rules( array $blocks ) {
		foreach ( $blocks as $b ) {
			$name  = $b['blockName'] ?? '';
			$attrs = $b['attrs'] ?? array();
			if ( in_array( $name, array( 'kit/band', 'kit/split', 'kit/cell', 'kit/layer' ), true )
				&& ! empty( $attrs['uniqueId'] ) && preg_match( '/^kc-\d+$/', (string) $attrs['uniqueId'] ) ) {
				$sel = '.' . $attrs['uniqueId'] . '.' . $attrs['uniqueId'];
				$d   = '';
				if ( ! empty( $attrs['fontSize'] ) && preg_match( '/^[a-z0-9-]+$/', $attrs['fontSize'] ) ) {
					$d .= ';font-size:var(--wp--preset--font-size--' . $attrs['fontSize'] . ')';
				}
				if ( ! empty( $attrs['gradient'] ) && preg_match( '/^[a-z0-9-]+$/', $attrs['gradient'] ) ) {
					$d .= ';background:var(--wp--preset--gradient--' . $attrs['gradient'] . ')';
				}
				if ( $d ) { Vibery_Blocks_Compiler::add( $sel, $d ); }
			}
			if ( ! empty( $b['innerBlocks'] ) ) { self::extra_rules( $b['innerBlocks'] ); }
		}
	}

	private static function base_css() {
		$css = '';
		foreach ( array( 'band', 'split', 'cell', 'layer' ) as $b ) {
			$f = VIBERY_BLOCKS_DIR . 'blocks/' . $b . '/style-index.css';
			if ( is_readable( $f ) ) { $css .= file_get_contents( $f ) . "\n"; }
		}
		$css .= file_get_contents( VIBERY_BLOCKS_DIR . 'assets/foreign-theme-compat.css' );
		return trim( preg_replace( '#/\*.*?\*/#s', '', $css ) );
	}

	/* ---------------------------------------------------------------------------------------------------
	 * Additional CSS sections
	 * ------------------------------------------------------------------------------------------------- */

	private static function section_re( $tag ) {
		return '#\n?/\* vibery-blocks:eject:' . $tag . ':begin \*/.*?/\* vibery-blocks:eject:' . $tag . ':end \*/\n?#s';
	}

	private static function custom_css( $stylesheet ) {
		$p = wp_get_custom_css_post( $stylesheet );
		return $p ? (string) $p->post_content : '';
	}

	private static function put_section( $css, $tag, $body ) {
		$block = "\n/* vibery-blocks:eject:{$tag}:begin */\n" . $body . "\n/* vibery-blocks:eject:{$tag}:end */\n";
		$re    = self::section_re( $tag );
		return preg_match( $re, $css ) ? preg_replace_callback( $re, function () use ( $block ) { return $block; }, $css, 1 ) : $css . $block;
	}

	private static function drop_section( $css, $tag ) {
		return preg_replace( self::section_re( $tag ), "\n", $css );
	}

	private static function ejected_posts() {
		$v = get_option( 'vibery_blocks_ejected', array() );
		return is_array( $v ) ? $v : array();
	}

	/* ---------------------------------------------------------------------------------------------------
	 * handlers
	 * ------------------------------------------------------------------------------------------------- */

	private static function err( $code, $msg, $status, $extra = array() ) {
		return new WP_Error( $code, $msg, array( 'status' => $status ) + $extra );
	}

	public static function handle_status( $request ) {
		$out = array( 'version' => VIBERY_BLOCKS_VER );
		$id  = (int) $request->get_param( 'post_id' );
		if ( $id ) {
			$post = get_post( $id );
			if ( ! $post || ! current_user_can( 'edit_post', $id ) ) { return self::err( 'not_found', 'post not found', 404 ); }
			$meta = get_post_meta( $id, self::META, true );
			$out['post'] = array(
				'ejected'    => is_array( $meta ),
				'kit_blocks' => false !== strpos( $post->post_content, '<!-- wp:kit/' ),
				'stylesheet' => is_array( $meta ) ? $meta['stylesheet'] : get_stylesheet(),
			);
		}
		return rest_ensure_response( $out );
	}

	public static function handle_eject( $request ) {
		$id   = (int) $request->get_param( 'post_id' );
		$dry  = (bool) $request->get_param( 'dry_run' );
		$post = get_post( $id );
		if ( ! $post ) { return self::err( 'not_found', 'post not found', 404 ); }
		if ( is_array( get_post_meta( $id, self::META, true ) ) ) {
			return rest_ensure_response( array( 'status' => 'noop', 'reason' => 'already_ejected', 'post_id' => $id ) );
		}
		if ( false === strpos( $post->post_content, '<!-- wp:kit/' ) && false === strpos( $post->post_content, '<!-- wp:core/block' ) && false === strpos( $post->post_content, '<!-- wp:block ' ) ) {
			return rest_ensure_response( array( 'status' => 'noop', 'reason' => 'no_kit_blocks', 'post_id' => $id ) );
		}
		$rep = array( 'converted' => array(), 'unsupported' => array(), 'warnings' => array() );
		$src = parse_blocks( $post->post_content );
		$new = self::convert( $src, $rep );
		if ( $rep['unsupported'] ) {
			return self::err( 'eject_unsupported', 'This page has content eject cannot carry over faithfully; nothing was changed.', 409, array( 'unsupported' => $rep['unsupported'] ) );
		}
		if ( ! $rep['converted'] ) {
			return rest_ensure_response( array( 'status' => 'noop', 'reason' => 'no_kit_blocks', 'post_id' => $id ) );
		}

		// compiled per-instance CSS for THIS post (fresh, not the cache) + preset extras.
		delete_post_meta( $id, '_vibery_blocks_css' );
		$css = vibery_blocks_compile_post( $id );
		Vibery_Blocks_Compiler::reset();
		self::extra_rules( $src );
		$css .= Vibery_Blocks_Compiler::css();
		if ( false !== strpos( $css, '<' ) || strlen( $css ) > self::MAX_CSS ) {
			return self::err( 'validation', 'compiled CSS failed the safety/size check; nothing was changed.', 422, array( 'fields' => array( array( 'field' => 'post_id', 'message' => 'css_unsafe_or_too_large' ) ) ) );
		}
		$ss      = get_stylesheet();
		$content = serialize_blocks( $new );
		$report  = array(
			'post_id'    => $id,
			'converted'  => $rep['converted'],
			'css_bytes'  => strlen( $css ),
			'stylesheet' => $ss,
			'warnings'   => array(),
		);
		if ( ! wp_is_block_theme() ) {
			// core/group carries core's flow-layout margin resets (:last-child / :first-child, specificity 0,2,0) that
			// can beat a classic theme's own paragraph margins; widths stay exact, block heights can move a few percent
			// (measured: Astra, -6.7% worst band). Block themes measured exact.
			$report['warnings'][] = array( 'code' => 'classic_theme_margins', 'detail' => 'classic theme: vertical rhythm inside bands may shift slightly after eject' );
		}
		if ( in_array( 'list_semantics_lost', $rep['warnings'], true ) ) {
			$report['warnings'][] = array( 'code' => 'list_semantics_lost', 'detail' => 'list rows (ul/ol) become plain groups: the layout is kept, screen readers no longer announce a list' );
		}
		if ( ! vibery_blocks_core_has_viewport_visibility() && false !== strpos( $post->post_content, '"viewport"' ) && false !== strpos( $post->post_content, '"blockVisibility"' ) ) {
			// WP < 7.0: per-viewport hiding is this plugin's polyfill; without the plugin those blocks show at every width
			$report['warnings'][] = array( 'code' => 'viewport_visibility_needs_wp7', 'detail' => 'blocks hidden on some screen sizes will show everywhere after removing the plugin until WordPress is 7.0 or newer' );
		}
		if ( $dry ) { return rest_ensure_response( array( 'status' => 'dry_run' ) + $report ); }

		$cur = self::custom_css( $ss );
		$cur = self::put_section( $cur, 'base', self::base_css() );
		$cur = self::put_section( $cur, 'post-' . $id, $css );
		$res = wp_update_custom_css_post( $cur, array( 'stylesheet' => $ss ) );
		if ( is_wp_error( $res ) ) { return self::err( 'css_write_failed', $res->get_error_message(), 500 ); }

		update_post_meta( $id, self::META, wp_slash( array(
			'content'    => $post->post_content,
			'after_hash' => hash( 'sha256', $content ),
			'stylesheet' => $ss,
			'version'    => VIBERY_BLOCKS_VER,
			'at'         => gmdate( 'c' ),
			'converted'  => $rep['converted'],
		) ) );
		$up = wp_update_post( wp_slash( array( 'ID' => $id, 'post_content' => $content ) ), true );
		if ( is_wp_error( $up ) ) {
			// content write failed: undo the CSS + meta so we never leave a half-ejected page.
			delete_post_meta( $id, self::META );
			$cur = self::drop_section( self::custom_css( $ss ), 'post-' . $id );
			wp_update_custom_css_post( $cur, array( 'stylesheet' => $ss ) );
			return self::err( 'write_failed', $up->get_error_message(), 500 );
		}
		$list        = self::ejected_posts();
		$list[ $id ] = $ss;
		update_option( 'vibery_blocks_ejected', $list, false );
		clean_post_cache( $id );
		return rest_ensure_response( array( 'status' => 'ejected', 'rev' => get_post( $id )->post_modified_gmt ) + $report );
	}

	public static function handle_revert( $request ) {
		$id   = (int) $request->get_param( 'post_id' );
		$post = get_post( $id );
		if ( ! $post ) { return self::err( 'not_found', 'post not found', 404 ); }
		$meta = get_post_meta( $id, self::META, true );
		if ( ! is_array( $meta ) || ! isset( $meta['content'] ) ) { return self::err( 'not_ejected', 'this post was not ejected by Vibery Blocks', 409 ); }
		if ( hash( 'sha256', $post->post_content ) !== $meta['after_hash'] && ! $request->get_param( 'force' ) ) {
			return self::err( 'modified_since_eject', 'the page was edited after eject; reverting would discard those edits (pass force to override).', 409 );
		}
		$up = wp_update_post( wp_slash( array( 'ID' => $id, 'post_content' => $meta['content'] ) ), true );
		if ( is_wp_error( $up ) ) { return self::err( 'write_failed', $up->get_error_message(), 500 ); }
		$ss   = (string) $meta['stylesheet'];
		$cur  = self::drop_section( self::custom_css( $ss ), 'post-' . $id );
		$list = self::ejected_posts();
		unset( $list[ $id ] );
		$still = array_filter( $list, function ( $s ) use ( $ss ) { return $s === $ss; } );
		if ( ! $still ) { $cur = self::drop_section( $cur, 'base' ); }
		$res = wp_update_custom_css_post( trim( $cur ), array( 'stylesheet' => $ss ) );
		if ( is_wp_error( $res ) ) { return self::err( 'css_write_failed', $res->get_error_message(), 500 ); }
		delete_post_meta( $id, self::META );
		delete_post_meta( $id, '_vibery_blocks_css' );
		update_option( 'vibery_blocks_ejected', $list, false );
		clean_post_cache( $id );
		return rest_ensure_response( array( 'status' => 'reverted', 'post_id' => $id, 'rev' => get_post( $id )->post_modified_gmt ) );
	}
}

add_action( 'rest_api_init', array( 'Vibery_Blocks_Eject', 'register_routes' ) );
