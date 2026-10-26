<?php
/**
 * Plugin Name: Kit Blocks
 * Description: The kit runtime layout containers — kit/band (full-bleed section), kit/split (fluid
 *   n-col grid, no core/columns), kit/cell (split child). STATIC save: load-bearing desktop layout
 *   is serialized into inline --kit-* custom props on the wrapper, so markup + layout SURVIVE plugin
 *   deactivation (only the ~40-line stylesheet's media-query stacking / ::before overlay / cover-image
 *   rules are lost). The trap registry dies by construction: kit/split never emits core/columns
 *   (traps 1+5+7), kit/band is full-bleed by its own CSS (traps 1+2+8). No render.php, no DB, no
 *   license server — 3 small GPL static-save blocks any WP dev can maintain.
 * Version: 1.0
 * Requires at least: 6.6
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 * Text Domain: kit-blocks
 */

defined( 'ABSPATH' ) || exit;

define( 'KIT_BLOCKS_VER', '1.0' );
define( 'KIT_BLOCKS_DIR', plugin_dir_path( __FILE__ ) );
define( 'KIT_BLOCKS_URL', plugin_dir_url( __FILE__ ) );

/**
 * Register the three blocks from their block.json metadata (apiVersion 3). Each block dir carries
 * block.json + index.js (editor) + style-index.css (front+editor) + index.css (editor-only).
 */
add_action( 'init', function () {
	foreach ( array( 'band', 'split', 'cell' ) as $b ) {
		register_block_type( KIT_BLOCKS_DIR . 'build/' . $b );
	}
} );

/**
 * Foreign-theme compat: when the site is NOT on kit-base, re-assert the trap-1/trap-2 fixes namespaced
 * to .kit-* so bands/splits stay correct under a theme that re-imports the contested defaults
 * (blockGap margins, root padding). Travels with the plugin, not the theme.
 */
add_action( 'wp_enqueue_scripts', function () {
	$compat = KIT_BLOCKS_DIR . 'assets/foreign-theme-compat.css';
	if ( file_exists( $compat ) ) {
		wp_enqueue_style( 'kit-blocks-compat', KIT_BLOCKS_URL . 'assets/foreign-theme-compat.css',
			array(), KIT_BLOCKS_VER );
	}
}, 20 );
