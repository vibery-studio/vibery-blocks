<?php
/**
 * kit/band — DYNAMIC render (E12). save() emits only InnerBlocks.Content, so there is no
 * saved-markup-vs-save() validation and the editor can never show "invalid content". This file
 * reproduces the full-bleed band wrapper the compiler's CSS targets, keyed on the block's uniqueId
 * (.kc-N). Per-instance styling (bg, overlay, min-height, contentMax, padding/color) is emitted by
 * includes/compiler.php keyed on that same .kc-N class — render.php only lays down structure + the
 * stable hooks the compiler selects on (.kit-band, .kit-band__inner).
 *
 * @var array    $attributes  block attributes
 * @var string   $content     serialized InnerBlocks HTML
 * @var WP_Block $block       block instance
 */
defined( 'ABSPATH' ) || exit;

$a   = is_array( $attributes ) ? $attributes : array();
$tag = isset( $a['tagName'] ) && preg_match( '/^[a-z][a-z0-9]*$/', (string) $a['tagName'] )
	? $a['tagName'] : 'section';
$tag = in_array( $tag, array( 'section', 'div', 'header', 'footer', 'aside', 'main', 'article' ), true )
	? $tag : 'section';

// uniqueId (.kc-N) is the styling hook; only a kc-\d+ is honored (matches the compiler's grammar).
$uid = '';
if ( ! empty( $a['uniqueId'] ) && preg_match( '/^kc-\d+$/', (string) $a['uniqueId'] ) ) {
	$uid = $a['uniqueId'];
}

// get_block_wrapper_attributes folds in core supports (anchor id, color/spacing/typography classes,
// the user className) so native editor controls keep working. We add our structural hooks + the kc.
$extra_class = trim( 'wp-block-kit-band kit-band ' . $uid );
$wrapper = get_block_wrapper_attributes( array( 'class' => $extra_class ) );

printf(
	'<%1$s %2$s><div class="kit-band__inner">%3$s</div></%1$s>',
	tag_escape( $tag ),
	$wrapper,        // built by core; already escaped
	$content         // serialized inner blocks; already rendered/escaped by core
);
