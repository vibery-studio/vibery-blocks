<?php
/**
 * Plugin Name: Vibery Blocks
 * Plugin URI:  https://github.com/vibery-studio/vibery-blocks
 * Description: Layout blocks for pages built with Vibery — kit/band (full-bleed section), kit/split (fluid n-column grid or wrapping row, no core/columns; optionally a real list), kit/cell (split child), kit/layer (bounded overlay) and kit/countdown. Per-viewport visibility uses WordPress 7's own block attribute (polyfilled on 6.3–6.9). Free, GPL, never licence-gated: rendering must not depend on a subscription. Includes a one-click "eject" that bakes the layout into plain core blocks + a static stylesheet so the pages keep looking the same if this plugin is removed.
 * Version: 1.0.0
 * Requires at least: 6.3
 * Requires PHP: 7.4
 * Author: Vibery
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: vibery-blocks
 *
 * Block names stay `kit/*` on purpose: pages already baked into hosted bundles and the template gallery
 * carry `<!-- wp:kit/band -->` in post_content, and a rename would orphan every one of them. The plugin
 * slug, PHP symbols, text domain and meta keys are Vibery's; the block namespace is the data contract.
 *
 * DYNAMIC blocks: save() = InnerBlocks.Content, render.php emits the wrapper, and the render-time compiler
 * (includes/compiler.php) paints each instance from its attrs keyed on `.kc-N`. The editor can therefore
 * never report "invalid content" for current content; older released save shapes migrate through
 * deprecated[] (blocks/*\/index.js). No licence check, no remote call anywhere in a render path.
 */

defined( 'ABSPATH' ) || exit;

if ( defined( 'VIBERY_BLOCKS_VER' ) ) {
	return; // loaded twice (e.g. mu-plugin + plugins dir) — first copy wins.
}

/**
 * The retired "Kit Blocks" plugin (slug kit-blocks, shipped inside older hosted bundles) registers the
 * same kit/* names. Two registrants would double-print CSS and fatal on duplicate registration; the old
 * one loads first (alphabetical), so we step aside, tell the admin, and let it keep serving until it is
 * deactivated — then this plugin takes over with no content change.
 */
if ( defined( 'KIT_BLOCKS_VER' ) || function_exists( 'kit_compile_post' ) ) {
	add_action( 'admin_notices', function () {
		if ( ! current_user_can( 'activate_plugins' ) ) { return; }
		echo '<div class="notice notice-warning"><p>' . esc_html__(
			'Vibery Blocks is installed but inactive in effect: the older "Kit Blocks" plugin is still active and registers the same blocks. Deactivate "Kit Blocks" — your pages keep working unchanged.',
			'vibery-blocks'
		) . '</p></div>';
	} );
	return;
}

define( 'VIBERY_BLOCKS_VER', '1.0.0' );
define( 'VIBERY_BLOCKS_FILE', __FILE__ );
define( 'VIBERY_BLOCKS_DIR', plugin_dir_path( __FILE__ ) );
define( 'VIBERY_BLOCKS_URL', plugin_dir_url( __FILE__ ) );

/** Post meta written by later build cards: {emitter_ver, conformance_ver, ir_id}. Registered now so the key
 *  and its shape are fixed before any writer exists. Not exposed over REST (the build layer writes it
 *  server-side); sanitised to exactly these three keys. */
add_action( 'init', function () {
	register_post_meta( '', '_vibery_build', array(
		'type'              => 'object',
		'single'            => true,
		'show_in_rest'      => false,
		'sanitize_callback' => 'vibery_blocks_sanitize_build_meta',
		'auth_callback'     => function ( $allowed, $meta_key, $post_id ) {
			return current_user_can( 'edit_post', (int) $post_id );
		},
	) );
} );

function vibery_blocks_sanitize_build_meta( $value ) {
	$value = is_array( $value ) ? $value : array();
	$out   = array();
	foreach ( array( 'emitter_ver', 'conformance_ver', 'ir_id' ) as $k ) {
		$out[ $k ] = isset( $value[ $k ] ) && is_scalar( $value[ $k ] )
			? substr( preg_replace( '/[^A-Za-z0-9._:-]/', '', (string) $value[ $k ] ), 0, 64 ) : '';
	}
	return $out;
}

/** Register the blocks from their block.json (apiVersion 3). */
add_action( 'init', function () {
	foreach ( array( 'band', 'split', 'cell', 'layer', 'countdown' ) as $b ) {
		register_block_type( VIBERY_BLOCKS_DIR . 'blocks/' . $b );
	}
} );

require_once VIBERY_BLOCKS_DIR . 'includes/compiler.php';
require_once VIBERY_BLOCKS_DIR . 'includes/eject.php';
require_once VIBERY_BLOCKS_DIR . 'includes/visibility.php';

/**
 * Foreign-theme compat: when the site is NOT on kit-base, re-assert the trap-1/trap-2 fixes namespaced to
 * .kit-* so bands/splits stay correct under a theme that re-imports the contested defaults (blockGap
 * margins, root padding). Only enqueued on a page that ACTUALLY contains kit blocks and is not on kit-base.
 */
add_action( 'wp_enqueue_scripts', function () {
	if ( get_stylesheet() === 'kit-base' ) { return; }
	$post = get_post();
	$has_kit = $post && (
		has_block( 'kit/band', $post ) || has_block( 'kit/split', $post ) || has_block( 'kit/cell', $post )
	);
	if ( ! $has_kit ) { return; }
	wp_enqueue_style( 'vibery-blocks-compat', VIBERY_BLOCKS_URL . 'assets/foreign-theme-compat.css', array(), VIBERY_BLOCKS_VER );
}, 20 );
