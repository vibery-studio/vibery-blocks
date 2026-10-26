<?php
/**
 * kit/layer — DYNAMIC render (K-2b). save() emits only InnerBlocks.Content, so the editor never reports invalid
 * content. Position/size/z come from includes/compiler.php keyed on the uniqueId (.kc-N). A decorative layer
 * (no text) is aria-hidden; a content layer is rendered where it sits in the block tree, so its text keeps the
 * reference's reading order.
 *
 * @var array    $attributes
 * @var string   $content
 * @var WP_Block $block
 */
defined( 'ABSPATH' ) || exit;

$a   = is_array( $attributes ) ? $attributes : array();
$uid = ( ! empty( $a['uniqueId'] ) && preg_match( '/^kc-\d+$/', (string) $a['uniqueId'] ) ) ? $a['uniqueId'] : '';

$extra = array( 'class' => trim( 'wp-block-kit-layer kit-layer ' . $uid ) );
if ( ! empty( $a['decorative'] ) ) {
	$extra['aria-hidden'] = 'true';
}
$wrapper = get_block_wrapper_attributes( $extra );

printf( '<div %1$s>%2$s</div>', $wrapper, $content );
