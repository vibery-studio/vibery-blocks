<?php
/**
 * Per-viewport block visibility — polyfill of WordPress 7.0+ core (wp-includes/block-supports/block-visibility.php).
 *
 * Contract = core's, byte for byte, so content never changes when a site upgrades:
 *   block attr  metadata.blockVisibility.viewport = { "mobile": false, "tablet": false, "desktop": false }
 *   render      class wp-block-hidden-<viewport> on the block's first tag + `display:none !important` in
 *               core's default viewport media queries (mobile ≤ 480px, tablet 480–782px, desktop > 782px).
 * WordPress 7.0+ renders this itself (and its editor edits it natively) → this file does nothing there.
 * On 6.3–6.9 core ignores the object (6.9 only knows `blockVisibility: false`), so we apply the same classes
 * and rules. Works for every block (kit/* and core/*): the build layer hides a reference's per-breakpoint
 * nodes with core's own attribute instead of a plugin-only one.
 *
 * Safety: the attribute is read as booleans only; class names come from a fixed list (never from content);
 * the CSS is a constant string printed by us (not KSES-filtered post content).
 */

defined( 'ABSPATH' ) || exit;

/** True when core renders metadata.blockVisibility.viewport itself (WordPress 7.0+). */
function vibery_blocks_core_has_viewport_visibility() {
	$v = isset( $GLOBALS['wp_version'] ) ? preg_replace( '/[^0-9.].*$/', '', (string) $GLOBALS['wp_version'] ) : '0';
	return version_compare( $v, '7.0', '>=' );
}

/** The viewports a block is hidden on, in core's order ([] when none / malformed). */
function vibery_blocks_hidden_viewports( $block ) {
	$vis = $block['attrs']['metadata']['blockVisibility'] ?? null;
	if ( ! is_array( $vis ) || ! isset( $vis['viewport'] ) || ! is_array( $vis['viewport'] ) ) {
		return array();
	}
	$out = array();
	foreach ( array( 'desktop', 'mobile', 'tablet' ) as $vp ) { // core sort()s the names: desktop, mobile, tablet
		if ( array_key_exists( $vp, $vis['viewport'] ) && false === $vis['viewport'][ $vp ] ) {
			$out[] = $vp;
		}
	}
	return $out;
}

/** Core's default viewport media queries (WP_Theme_JSON::DEFAULT_VIEWPORT_BREAKPOINTS 480px / 782px). */
function vibery_blocks_visibility_css() {
	return '@media (width <= 480px){.wp-block-hidden-mobile{display:none !important}}'
		. '@media (480px < width <= 782px){.wp-block-hidden-tablet{display:none !important}}'
		. '@media (width > 782px){.wp-block-hidden-desktop{display:none !important}}';
}

function vibery_blocks_visibility_render( $html, $block ) {
	if ( '' === $html || vibery_blocks_core_has_viewport_visibility() ) {
		return $html;
	}
	$hidden = vibery_blocks_hidden_viewports( $block );
	if ( ! $hidden ) {
		return $html;
	}
	$p = new WP_HTML_Tag_Processor( $html );
	if ( ! $p->next_tag() ) {
		return $html;
	}
	foreach ( $hidden as $vp ) {
		$p->add_class( 'wp-block-hidden-' . $vp );
	}
	static $printed = false;
	if ( ! $printed ) {
		$printed = true;
		if ( ! wp_style_is( 'vibery-blocks-visibility', 'registered' ) ) { wp_register_style( 'vibery-blocks-visibility', false ); }
		wp_enqueue_style( 'vibery-blocks-visibility' );
		wp_add_inline_style( 'vibery-blocks-visibility', vibery_blocks_visibility_css() );
	}
	return $p->get_updated_html();
}
add_filter( 'render_block', 'vibery_blocks_visibility_render', 10, 2 );
