<?php
/**
 * Motion — scroll reveal, hover, transition presets and stagger as ONE block attribute on EVERY block
 * (core/* and kit/*). CSS-first: transform + opacity only (0 layout shift), a ~1 KB IntersectionObserver
 * script, no jQuery, `prefers-reduced-motion` turns everything off. Nothing JS-dependent hides content:
 * the hidden state exists only under `html.vb-js`, set by a head snippet that also self-removes after 4 s if the
 * observer script never ran.
 *
 * Contract (stored in the block comment JSON, never in saved HTML → static core blocks stay valid):
 *   attrs.vbMotion = { reveal?: fade|up|down|left|right|zoom, hover?: lift|zoom|glow|dim,
 *                      ease?: soft|snappy|spring, dur?: 150..1500 (ms), delay?: 0..2000 (ms),
 *                      stagger?: 20..400 (ms; reveals the CHILDREN one after another) }
 * Render: classes `vb-m vb-r-<reveal> vb-h-<hover> vb-e-<ease> vb-stagger` + inline custom props
 * `--vb-dur --vb-delay --vb-step` on the block's first tag. Class names come from fixed lists, numbers are
 * clamped ints: nothing from content reaches markup or CSS unvalidated.
 */

defined( 'ABSPATH' ) || exit;

function vibery_blocks_motion_enums() {
	return array(
		'reveal' => array( 'fade', 'up', 'down', 'left', 'right', 'zoom' ),
		'hover'  => array( 'lift', 'zoom', 'glow', 'dim' ),
		'ease'   => array( 'soft', 'snappy', 'spring' ),
	);
}

/** Validate a raw vbMotion attribute → normalised array (unknown keys / values dropped). */
function vibery_blocks_motion_clean( $raw ) {
	if ( ! is_array( $raw ) ) { return array(); }
	$out = array();
	foreach ( vibery_blocks_motion_enums() as $k => $allowed ) {
		if ( isset( $raw[ $k ] ) && is_string( $raw[ $k ] ) && in_array( $raw[ $k ], $allowed, true ) ) { $out[ $k ] = $raw[ $k ]; }
	}
	foreach ( array( 'dur' => array( 150, 1500 ), 'delay' => array( 0, 2000 ), 'stagger' => array( 20, 400 ) ) as $k => $r ) {
		if ( isset( $raw[ $k ] ) && is_numeric( $raw[ $k ] ) ) { $out[ $k ] = max( $r[0], min( $r[1], (int) $raw[ $k ] ) ); }
	}
	return $out;
}

/** Every block type accepts the attribute (server side), so the parser/REST keep it and the editor can set it. */
add_filter( 'register_block_type_args', function ( $args, $name ) {
	$args['attributes'] = isset( $args['attributes'] ) && is_array( $args['attributes'] ) ? $args['attributes'] : array();
	if ( ! isset( $args['attributes']['vbMotion'] ) ) { $args['attributes']['vbMotion'] = array( 'type' => 'object' ); }
	return $args;
}, 10, 2 );

function vibery_blocks_motion_render( $html, $block ) {
	if ( '' === $html || empty( $block['attrs']['vbMotion'] ) ) { return $html; }
	$m = vibery_blocks_motion_clean( $block['attrs']['vbMotion'] );
	if ( ! $m ) { return $html; }
	$p = new WP_HTML_Tag_Processor( $html );
	if ( ! $p->next_tag() ) { return $html; }
	$p->add_class( 'vb-m' );
	if ( isset( $m['reveal'] ) ) { $p->add_class( 'vb-r-' . $m['reveal'] ); }
	if ( isset( $m['hover'] ) )  { $p->add_class( 'vb-h-' . $m['hover'] ); }
	if ( isset( $m['ease'] ) )   { $p->add_class( 'vb-e-' . $m['ease'] ); }
	$style = array();
	if ( isset( $m['stagger'] ) ) { $p->add_class( 'vb-stagger' ); $style[] = '--vb-step:' . $m['stagger'] . 'ms'; }
	if ( isset( $m['dur'] ) )     { $style[] = '--vb-dur:' . $m['dur'] . 'ms'; }
	if ( isset( $m['delay'] ) )   { $style[] = '--vb-delay:' . $m['delay'] . 'ms'; }
	if ( $style ) {
		$old = (string) $p->get_attribute( 'style' );
		$p->set_attribute( 'style', ( '' !== trim( $old ) ? rtrim( trim( $old ), ';' ) . ';' : '' ) . implode( ';', $style ) );
	}
	$GLOBALS['vibery_blocks_motion_used'] = true;
	return $p->get_updated_html();
}
add_filter( 'render_block', 'vibery_blocks_motion_render', 11, 2 );

/** Front end: stylesheet always (≈2 KB, so the hidden state is in place before first paint), script in the footer
 *  only when a block on this request used motion. */
add_action( 'wp_enqueue_scripts', function () {
	wp_enqueue_style( 'vibery-blocks-motion', VIBERY_BLOCKS_URL . 'assets/motion/motion.css', array(), VIBERY_BLOCKS_VER );
	wp_register_script( 'vibery-blocks-motion', VIBERY_BLOCKS_URL . 'assets/motion/motion.js', array(), VIBERY_BLOCKS_VER, array( 'strategy' => 'defer', 'in_footer' => true ) );
}, 5 );

add_action( 'wp_footer', function () {
	if ( ! empty( $GLOBALS['vibery_blocks_motion_used'] ) ) { wp_print_scripts( 'vibery-blocks-motion' ); }
}, 1 );

/** Head: arm the hidden state only when JS runs; a 4 s failsafe un-arms it if motion.js never reports in. */
add_action( 'wp_head', function () {
	echo '<script>(function(d){if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;d.classList.add("vb-js");setTimeout(function(){window.__vbm||d.classList.remove("vb-js")},4000)})(document.documentElement)</script>' . "\n";
}, 1 );

/** Editor: controls (all blocks) + preview toggle; styles/scripts load inside the editor iframe too. */
add_action( 'enqueue_block_editor_assets', function () {
	wp_enqueue_script( 'vibery-blocks-motion-editor', VIBERY_BLOCKS_URL . 'assets/motion/editor.js',
		array( 'wp-hooks', 'wp-compose', 'wp-element', 'wp-components', 'wp-block-editor', 'wp-data', 'wp-i18n' ), VIBERY_BLOCKS_VER, true );
} );
add_action( 'enqueue_block_assets', function () {
	if ( is_admin() ) { wp_enqueue_style( 'vibery-blocks-motion', VIBERY_BLOCKS_URL . 'assets/motion/motion.css', array(), VIBERY_BLOCKS_VER ); }
} );
