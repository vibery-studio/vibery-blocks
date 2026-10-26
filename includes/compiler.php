<?php
/**
 * vibery-blocks render-time CSS compiler — THE ONLY compiler (driver decision: an editor whose attr edits
 * don't paint is a lying editor, so the compile lives on the render path; one compiler, no drift).
 *
 * Security + core-alignment (recon/18 WP-source-truths, ENGINE ACTIONS 1-3):
 *  - the `attrs['style']` subset is compiled by CORE'S style engine (wp_style_engine_get_styles), not a
 *    hand-mirror — same grammar WP uses, no drift, no missed escaping (recon/18 §1, action 1).
 *  - EVERY generated declaration string passes through safecss_filter_attr() (KSES) before it can enter
 *    the stylesheet: property allow-list, url() protocol checks, gradient checks, unsafe-char rejection
 *    (recon/18 §2, action 3). Editor-editable attrs are an injection surface; this closes it.
 *  - every kit layout attr is TYPE-VALIDATED against a per-attr grammar (cols/gap/pad/valign/justify/
 *    colors/overlay) before use; a value that doesn't match its grammar is dropped, not interpolated.
 *  - the generated CSS is rendered by core's style engine (wp_style_engine_get_stylesheet_from_css_rules) and
 *    attached as an inline style per rendering post — render-driven, NOT is_singular()-only, so archives /
 *    query loops / search render styled (recon/18 §5, action 2).
 *
 * down_convert emits ATTRS-ONLY markup (zero inline style); the styling is reconstructed here from attrs.
 */

defined( 'ABSPATH' ) || exit;

/**
 * Layout properties the compiler needs that older cores omit from KSES' inline-style allow-list. Applied
 * ONLY around our own safecss_filter_attr() call (see vibery_blocks_safe_decls) — never site-wide, so the
 * plugin does not widen what core allows in any other content. We widen the PROPERTY NAMES to a known-safe
 * layout set; safecss_filter_attr() still checks url()/gradient/unsafe-char on the VALUES. The list names EVERY
 * property the compiler emits, not just the ones an older core lacks: WP 6.9 omits `display` (and others) from the
 * default list, which silently turned every kit/split into a stacked block until this was explicit.
 */
function vibery_blocks_extra_safe_props( $props ) {
	return array_merge( $props, array(
		'margin-inline', 'margin-block', 'inset', 'box-sizing', 'pointer-events', 'object-fit',
		'object-position', 'aspect-ratio', 'container-type', 'inset-inline', 'inset-block',
		'display', 'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-content', 'grid-template-columns',
		'gap', 'position', 'z-index', 'overflow', 'min-width', 'min-height', 'max-width', 'width', 'height',
		'content', 'row-gap', 'column-gap', 'place-items', 'place-content', 'grid-auto-rows', 'grid-auto-columns',
		'grid-template-rows', 'grid-template-areas', 'overflow-x', 'overflow-y', 'isolation',
	) );
}

/* ----------------------------------------------------------------------------------------------------
 * Typed-attr validators — a value that fails its grammar returns '' (dropped), never interpolated raw.
 * -------------------------------------------------------------------------------------------------- */
function vibery_blocks_v_length( $v ) {            // a single CSS length / %: 56px, 1.2rem, 24%, 0, clamp(...)
	$v = trim( (string) $v );
	if ( $v === '0' ) { return '0'; }
	if ( preg_match( '/^-?\d*\.?\d+(px|rem|em|%|vw|vh|ch|fr)$/', $v ) ) { return $v; }
	if ( preg_match( '/^(clamp|calc|min|max|minmax|var)\([^{};<>]*\)$/', $v ) ) { return $v; }
	return '';
}
function vibery_blocks_v_length_list( $v ) {        // a space-separated length list (padding shorthand / cols)
	$v = trim( (string) $v );
	// allow lengths, %, fr, keywords auto/none, and balanced clamp/calc/min/max/minmax/repeat/var
	if ( preg_match( '/^[0-9a-zA-Z%.\s,()_\-]+$/', $v ) && ! preg_match( '/[<>{};@\\\\]/', $v )
		&& strpos( $v, 'url' ) === false && strpos( $v, 'expression' ) === false ) {
		return $v;
	}
	return '';
}
function vibery_blocks_v_enum( $v, $allowed ) { return in_array( $v, $allowed, true ) ? $v : ''; }
function vibery_blocks_v_color( $v ) {               // #hex, rgb/rgba/hsl(...), or a preset var()
	$v = trim( (string) $v );
	if ( preg_match( '/^#[0-9a-fA-F]{3,8}$/', $v ) ) { return $v; }
	if ( preg_match( '/^(rgb|rgba|hsl|hsla)\([0-9.,%\s\/]+\)$/', $v ) ) { return $v; }
	if ( preg_match( '/^var\(--wp--preset--color--[a-z0-9-]+\)$/', $v ) ) { return $v; }
	return '';
}
function vibery_blocks_v_url( $v ) {                  // a manifest media URL; protocol-checked by KSES later too
	$v = trim( (string) $v );
	return ( filter_var( $v, FILTER_VALIDATE_URL ) && preg_match( '#^https?://#', $v ) ) ? $v : '';
}
/** overlay is no longer freeform CSS: accept ONLY a CSS gradient or a color (recon/18 action 1). KSES
 *  re-checks the gradient on the `background` property. */
function vibery_blocks_v_overlay( $v ) {
	$v = trim( (string) $v );
	if ( preg_match( '/^(linear|radial|conic)-gradient\([^{}<>;]*\)$/', $v ) ) { return $v; }
	return vibery_blocks_v_color( $v );
}

/** Run a "prop:value;prop:value" decl string through core KSES inline-style filtering. Anything not on
 *  the safe_style_css allow-list (or a bad url/gradient/unsafe char) is stripped by core. Returns '' if
 *  nothing survives. This is the last line of defense before a declaration enters the stylesheet. */
function vibery_blocks_safe_decls( $decls ) {
	$decls = trim( $decls, "; \n\t" );
	if ( $decls === '' ) { return ''; }
	add_filter( 'safe_style_css', 'vibery_blocks_extra_safe_props' );
	$safe = safecss_filter_attr( $decls );
	remove_filter( 'safe_style_css', 'vibery_blocks_extra_safe_props' );
	return $safe ? $safe : '';
}

/** kitCss is author-supplied residue: besides KSES it must pass OUR property/value whitelist — layout,
 *  box, typography and colour only; no url()/@/\\/expression, no position:fixed (page-overlay), bounded
 *  length. Returns the surviving "prop:value" declarations joined by ';' ('' if none). */
function vibery_blocks_residue_decls( $decls ) {
	static $allowed = array(
		'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'margin-inline', 'margin-block',
		'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
		'width', 'max-width', 'min-width', 'height', 'max-height', 'min-height', 'aspect-ratio', 'box-sizing',
		'display', 'flex', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
		'justify-content', 'align-items', 'align-content', 'align-self', 'justify-self', 'place-items', 'gap',
		'row-gap', 'column-gap', 'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
		'order', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'overflow', 'overflow-x', 'overflow-y',
		'color', 'background-color', 'opacity', 'border', 'border-top', 'border-right', 'border-bottom',
		'border-left', 'border-width', 'border-style', 'border-color', 'border-radius', 'font-size',
		'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform',
		'text-decoration', 'white-space', 'object-fit', 'object-position', 'transform',
	);
	$out = array();
	foreach ( explode( ';', substr( (string) $decls, 0, 2000 ) ) as $d ) {
		if ( strpos( $d, ':' ) === false ) { continue; }
		list( $p, $v ) = array_map( 'trim', explode( ':', $d, 2 ) );
		$p = strtolower( $p );
		if ( ! in_array( $p, $allowed, true ) || $v === '' ) { continue; }
		if ( preg_match( '/[<>{}@\\\\]|url\s*\(|expression|javascript|!important|\/\*/i', $v ) ) { continue; }
		if ( 'position' === $p && ! in_array( strtolower( $v ), array( 'relative', 'absolute', 'static', 'sticky' ), true ) ) { continue; }
		if ( 'display' === $p && ! preg_match( '/^(block|inline|inline-block|flex|inline-flex|grid|inline-grid|none|contents)$/i', $v ) ) { continue; }
		$out[] = $p . ':' . $v;
	}
	return implode( ';', $out );
}

/* ----------------------------------------------------------------------------------------------------
 * Style-engine store accumulator (recon/18 action 2).
 * -------------------------------------------------------------------------------------------------- */
final class Vibery_Blocks_Compiler {
	public static $rules = array();   // [ ['selector'=>'.kc-1','declarations'=>['display'=>'grid',...]], ... ]
	public static $media = array();   // [ '@media (max-width:782px)' => [ ['selector'=>..,'declarations'=>..] ] ]

	public static function reset() { self::$rules = array(); self::$media = array(); }

	/** add a rule from a SAFE declaration STRING (already KSES-filtered). Converts to the engine's
	 *  declarations array (prop=>value) for wp_style_engine_get_stylesheet_from_css_rules(). */
	public static function add( $selector, $decls_str, $media = '' ) {
		$decls_str = vibery_blocks_safe_decls( $decls_str );
		if ( $decls_str === '' ) { return; }
		$declarations = array();
		foreach ( explode( ';', $decls_str ) as $d ) {
			$d = trim( $d );
			if ( $d === '' || strpos( $d, ':' ) === false ) { continue; }
			list( $p, $val ) = array_map( 'trim', explode( ':', $d, 2 ) );
			if ( $p !== '' ) { $declarations[ $p ] = $val; }
		}
		if ( ! $declarations ) { return; }
		$rule = array( 'selector' => $selector, 'declarations' => $declarations );
		if ( $media ) { self::$media[ $media ][] = $rule; }
		else { self::$rules[] = $rule; }
	}

	/** Render the page CSS via CORE'S style engine (so selectors/media are core-formatted + deduped). */
	public static function css() {
		// core's style engine runs every declaration through safecss_filter_attr() again, so the layout
		// property names must be allowed for this call too (scoped: filter added then removed).
		add_filter( 'safe_style_css', 'vibery_blocks_extra_safe_props' );
		$css = '';
		if ( self::$rules ) {
			$css .= wp_style_engine_get_stylesheet_from_css_rules( self::$rules, array() );
		}
		foreach ( self::$media as $query => $rules ) {
			$inner = wp_style_engine_get_stylesheet_from_css_rules( $rules, array() );
			if ( $inner ) { $css .= $query . '{' . $inner . '}'; }
		}
		remove_filter( 'safe_style_css', 'vibery_blocks_extra_safe_props' );
		return $css;
	}
}

/** Compile the `attrs['style']` subset via CORE'S style engine (recon/18 action 1) + named colors. */
function vibery_blocks_style_decls( $attrs ) {
	$style = isset( $attrs['style'] ) && is_array( $attrs['style'] ) ? $attrs['style'] : array();
	$out = '';
	if ( $style ) {
		$res = wp_style_engine_get_styles( $style );   // core grammar -> 'css' string
		if ( ! empty( $res['css'] ) ) { $out .= $res['css']; }
	}
	if ( ! empty( $attrs['backgroundColor'] ) && preg_match( '/^[a-z0-9-]+$/', $attrs['backgroundColor'] ) ) {
		$out .= ';background-color:var(--wp--preset--color--' . $attrs['backgroundColor'] . ')';
	}
	if ( ! empty( $attrs['textColor'] ) && preg_match( '/^[a-z0-9-]+$/', $attrs['textColor'] ) ) {
		$out .= ';color:var(--wp--preset--color--' . $attrs['textColor'] . ')';
	}
	return $out;
}

/** Compile ONE block by name+attrs+uniqueId into Vibery_Blocks_Compiler. Layout decls are typed-validated; the
 *  style subset goes through the core engine; everything is KSES-filtered in Vibery_Blocks_Compiler::add(). */
function vibery_blocks_compile_block( $name, $attrs, $uid ) {
	if ( ! $uid || ! preg_match( '/^kc-\d+$/', $uid ) ) { return; }
	// spike/tf-law-firm (S1): DOUBLE the class so kc rules (0,2,0) beat core's layout-support resets
	// `.is-layout-constrained > *{margin-block:0}` / `> *+*{margin-block-start:var(--wp--style--block-gap)}`
	// (0,1,0). Before this, every authored margin on a core block INSIDE a core/group was silently zeroed
	// (measured: -5..-13% section height on law-firm). Same rule everywhere, no !important.
	$sel = '.' . $uid . '.' . $uid;
	$base = vibery_blocks_style_decls( $attrs );

	if ( 'kit/band' === $name ) {
		$d = 'position:relative;width:100%;box-sizing:border-box';
		$mh = vibery_blocks_v_length( $attrs['minHeight'] ?? '' );
		if ( $mh ) { $d .= ';min-height:' . $mh; }
		$bg = vibery_blocks_v_url( $attrs['bgImageUrl'] ?? '' );
		if ( $bg ) {
			$pos = vibery_blocks_v_length_list( $attrs['bgPosition'] ?? 'center center' ) ?: 'center center';
			$size = vibery_blocks_v_enum( $attrs['bgSize'] ?? 'cover', array( 'cover', 'contain', 'auto' ) ) ?: 'cover';
			$d .= ';background-image:url(' . esc_url( $bg ) . ');background-position:' . $pos
				. ';background-size:' . $size . ';background-repeat:no-repeat';
		}
		Vibery_Blocks_Compiler::add( $sel, $d . ';' . $base );
		$ov = vibery_blocks_v_overlay( $attrs['overlay'] ?? '' );
		if ( $ov ) { Vibery_Blocks_Compiler::add( $sel . '::before', "content:'';position:absolute;inset:0;background:" . $ov . ';pointer-events:none;z-index:0' ); }
		$inner = 'position:relative;z-index:1';
		$cmax = vibery_blocks_v_length( $attrs['contentMax'] ?? '' );
		if ( $cmax ) { $inner .= ';max-width:' . $cmax . ';margin-inline:auto'; }
		Vibery_Blocks_Compiler::add( $sel . ' > .kit-band__inner', $inner );
		if ( $mh ) {
			Vibery_Blocks_Compiler::add( $sel, 'display:flex;flex-direction:column' );
			Vibery_Blocks_Compiler::add( $sel . ' > .kit-band__inner', 'flex:1;display:flex;flex-direction:column' );
			Vibery_Blocks_Compiler::add( $sel . ' > .kit-band__inner > .kit-split', 'flex:1' );
		}
	} elseif ( 'kit/split' === $name ) {
		$cols = vibery_blocks_v_length_list( $attrs['cols'] ?? '1fr 1fr' ) ?: '1fr 1fr';
		$gap  = vibery_blocks_v_length( $attrs['gap'] ?? '0' );
		$gap  = ( $gap === '' ) ? '0' : $gap;
		$rgap = vibery_blocks_v_length( $attrs['rowGap'] ?? '' ) ?: $gap;
		$valign = vibery_blocks_v_enum( $attrs['valign'] ?? 'stretch', array( 'stretch', 'start', 'center', 'end', 'flex-start', 'flex-end' ) ) ?: 'stretch';
		$d = 'display:grid;grid-template-columns:' . $cols . ';gap:' . $gap . ';row-gap:' . $rgap
			. ';align-items:' . $valign . ';box-sizing:border-box';
		Vibery_Blocks_Compiler::add( $sel, $d . ';' . $base );
		$stack = vibery_blocks_v_length( $attrs['stackAt'] ?? '782px' );
		if ( $stack ) {
			$scols = vibery_blocks_v_length_list( $attrs['stackCols'] ?? '1fr' ) ?: '1fr';
			Vibery_Blocks_Compiler::add( $sel, 'grid-template-columns:' . $scols, '@media (max-width:' . $stack . ')' );
		}
	} elseif ( 'kit/cell' === $name ) {
		$d = 'position:relative;box-sizing:border-box;min-width:0';
		$pad = vibery_blocks_v_length_list( $attrs['pad'] ?? '' );
		if ( $pad ) { $d .= ';padding:' . $pad; }
		$just = vibery_blocks_v_enum( $attrs['justify'] ?? '', array( 'flex-start', 'center', 'flex-end', 'space-between', 'start', 'end' ) );
		if ( $just ) { $d .= ';display:flex;flex-direction:column;justify-content:' . $just; }
		if ( ( $attrs['type'] ?? '' ) === 'cover-image' ) {
			$d .= ';overflow:hidden';
			Vibery_Blocks_Compiler::add( $sel . ' img', 'width:100%;height:100%;object-fit:cover;display:block;margin:0' );
		}
		Vibery_Blocks_Compiler::add( $sel, $d . ';' . $base );
	} else {
		// core block: paint its style/named-color attrs (the attrs-don't-paint-static trap, recon/18 §3).
		$d = $base;
		$kg = vibery_blocks_v_length( $attrs['kitGap'] ?? '' );
		if ( $kg ) { $d .= ';display:flex;flex-direction:column;gap:' . $kg; }
		if ( $d ) { Vibery_Blocks_Compiler::add( $sel, $d ); }
	}

	// one-off residue: raw CSS is NOT trusted. Each declaration in the kc-keyed block goes through KSES;
	// anything not on the safe_style_css allow-list is stripped (recon/18 action 3). Selector is forced
	// to the uniqueId so residue can never escape its block.
	if ( ! empty( $attrs['kitCss'] ) ) {
		// kitCss is "<sel>{decls}" possibly repeated; re-scope every block to THIS uid + KSES the decls.
		if ( preg_match_all( '/\{([^}]*)\}/', (string) $attrs['kitCss'], $mm ) ) {
			foreach ( $mm[1] as $decls ) { Vibery_Blocks_Compiler::add( $sel, vibery_blocks_residue_decls( $decls ) ); }
		}
	}
}

/**
 * Compile a post's blocks -> page CSS, CACHED in post meta. Cache key includes plugin version, the
 * global-styles hash, and post_modified so a theme-token change or an edit invalidates it (FU2 item 2).
 */
function vibery_blocks_compile_post( $post_id ) {
	$post = get_post( $post_id );
	if ( ! $post ) { return ''; }
	$gs_hash = md5( (string) wp_get_global_stylesheet( array( 'variables', 'presets' ) ) );
	$key = implode( ':', array( VIBERY_BLOCKS_VER, $gs_hash, get_post_modified_time( 'U', true, $post_id ) ) );
	$cache = get_post_meta( $post_id, '_vibery_blocks_css', true );
	if ( is_array( $cache ) && isset( $cache['k'] ) && $cache['k'] === $key ) { return $cache['css']; }

	Vibery_Blocks_Compiler::reset();
	$seen_uid = array();
	$walk = function ( $list ) use ( &$walk, &$seen_uid ) {
		foreach ( $list as $b ) {
			$name = $b['blockName'] ?? '';
			$attrs = $b['attrs'] ?? array();
			$uid = '';
			if ( ! empty( $attrs['uniqueId'] ) && preg_match( '/^kc-\d+$/', $attrs['uniqueId'] ) ) {
				$uid = $attrs['uniqueId'];
			} elseif ( ! empty( $attrs['className'] ) && preg_match( '/\b(kc-\d+)\b/', $attrs['className'], $m ) ) {
				$uid = $m[1];
			}
			// uniqueId COLLISION (copy/paste between pages): if this kc-N already appeared on the page,
			// the second instance would share the first's CSS. Skip the duplicate compile (its markup
			// already carries the kc class, so it inherits the first rule) and log — deterministic.
			if ( $uid ) {
				if ( isset( $seen_uid[ $uid ] ) ) { /* duplicate; first rule already covers it */ }
				else { $seen_uid[ $uid ] = true; if ( $name && ( strpos( $name, 'kit/' ) === 0 || $uid ) ) { vibery_blocks_compile_block( $name, $attrs, $uid ); } }
			}
			// synced patterns / reusable blocks: compile the referenced entity's blocks too.
			if ( 'core/block' === $name && ! empty( $attrs['ref'] ) ) {
				$ref = get_post( (int) $attrs['ref'] );
				if ( $ref ) { $walk( parse_blocks( $ref->post_content ) ); }
			}
			if ( ! empty( $b['innerBlocks'] ) ) { $walk( $b['innerBlocks'] ); }
		}
	};
	$walk( parse_blocks( $post->post_content ) );
	$css = Vibery_Blocks_Compiler::css();
	update_post_meta( $post_id, '_vibery_blocks_css', array( 'k' => $key, 'css' => $css ) );
	return $css;
}

/** Invalidate on save (the cache key also self-invalidates on token/edit change, belt-and-suspenders). */
add_action( 'save_post', function ( $post_id ) { delete_post_meta( $post_id, '_vibery_blocks_css' ); } );

/**
 * Print the compiled CSS for whatever kit-bearing post is rendering — render-driven, NOT is_singular()
 * only, so archives / query loops / search / previews render styled (recon/18 action 2). We feed the
 * CSS into core's style-engine store and let wp_enqueue_stored_styles() print it as
 * `wp-style-engine-kit-blocks`. For singular + preview we compile the queried post; inside a query loop
 * we compile each post as its template renders (render_block-driven below).
 */
function vibery_blocks_enqueue_css_for( $post_id ) {
	static $done = array();
	if ( ! $post_id || isset( $done[ $post_id ] ) ) { return; }
	$done[ $post_id ] = true;
	// preview/autosave: compile the autosave content if present so the editor preview paints.
	if ( is_preview() ) {
		$preview = wp_get_post_autosave( $post_id );
		if ( $preview ) { $post_id = $preview->ID; }
	}
	$css = vibery_blocks_compile_post( $post_id );
	if ( $css ) {
		// stash our compiled CSS into a registered handle that prints in the head regardless of is_singular
		if ( ! wp_style_is( 'vibery-blocks-compiled', 'registered' ) ) { wp_register_style( 'vibery-blocks-compiled', false ); }
		wp_enqueue_style( 'vibery-blocks-compiled' );
		wp_add_inline_style( 'vibery-blocks-compiled', $css );
	}
}

// singular + previews: compile the queried object.
add_action( 'wp_enqueue_scripts', function () {
	$id = get_queried_object_id();
	if ( $id && ( is_singular() || is_preview() ) ) { vibery_blocks_enqueue_css_for( $id ); }
}, 30 );

// archives / query loops / search: compile each post as its content renders (render_block-driven,
// context-free) so kit blocks are styled outside is_singular too.
add_filter( 'render_block', function ( $html, $block ) {
	if ( ! empty( $block['blockName'] ) && strpos( $block['blockName'], 'kit/' ) === 0 ) {
		$id = get_the_ID();
		if ( $id ) { vibery_blocks_enqueue_css_for( $id ); }
	}
	return $html;
}, 10, 2 );

/**
 * E13 — EDITOR FAITHFULNESS: the block editor renders blocks in an IFRAME (WP 6.3+) that never hits
 * wp_enqueue_scripts / render_block, so the FRONTEND-only paths above never reach it. The editor got
 * valid markup + the skeleton editorStyle (index.css) but NOT the per-instance compiled sheet that
 * actually paints the layout (cols/gap/digit-circles/bg) — hence E12's valid-but-bare editor.
 *
 * Fix: feed the SAME compiler's output into the editor via the editor-styles channel. A raw
 * wp_enqueue_style on admin hooks would NOT reach the iframe; the block_editor_settings_all 'styles'
 * array IS iframed by the editor (each {css:...} entry is injected inside the canvas iframe). We
 * compile the CURRENTLY-EDITED post from $context->post and append its CSS as one editor style.
 *
 * ONE compiler, no second implementation: vibery_blocks_compile_post() is the same function the frontend uses,
 * keyed on the same .kc-N hooks that edit() now folds onto the editor wrapper (each block's index.js, E13).
 * Initial load + saved state are covered here; live attr edits paint client-side because edit() applies
 * the same .kc-N class + inline custom props it saves (no server round-trip for the structural hooks).
 */
add_filter( 'block_editor_settings_all', function ( $settings, $context ) {
	$post = ( $context && isset( $context->post ) && $context->post instanceof WP_Post ) ? $context->post : null;
	if ( ! $post ) { return $settings; }
	// only spend the compile when the post actually carries kit blocks.
	if ( ! ( has_block( 'kit/band', $post ) || has_block( 'kit/split', $post ) || has_block( 'kit/cell', $post ) ) ) {
		return $settings;
	}
	$css = vibery_blocks_compile_post( $post->ID );
	if ( ! $css ) { return $settings; }
	if ( ! isset( $settings['styles'] ) || ! is_array( $settings['styles'] ) ) { $settings['styles'] = array(); }
	// __unstableType=plugin so core treats it as a plugin-provided editor style (kept distinct from
	// theme styles); the css is injected into the editor-canvas iframe so the editor paints identically.
	$settings['styles'][] = array( 'css' => $css, '__unstableType' => 'plugin', 'isGlobalStyles' => false );
	return $settings;
}, 10, 2 );
