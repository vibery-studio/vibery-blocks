<?php
/**
 * kit/cell — DYNAMIC render (E12). A kit/split child. save() emits only InnerBlocks.Content, so no
 * markup-validation -> no "invalid content" in the editor. Per-instance values (padding, justify flex,
 * cover-image fill) are emitted by includes/compiler.php keyed on the block's uniqueId (.kc-N);
 * render.php lays down the wrapper + the modifier classes the compiler/stylesheet select on
 * (.kit-cell, .kit-cell--cover, .kit-cell--flex).
 *
 * @var array    $attributes
 * @var string   $content
 * @var WP_Block $block
 */
defined( 'ABSPATH' ) || exit;

$a = is_array( $attributes ) ? $attributes : array();

$uid = '';
if ( ! empty( $a['uniqueId'] ) && preg_match( '/^kc-\d+$/', (string) $a['uniqueId'] ) ) {
	$uid = $a['uniqueId'];
}

$classes = array( 'wp-block-kit-cell', 'kit-cell' );
if ( ( $a['type'] ?? '' ) === 'cover-image' ) {
	$classes[] = 'kit-cell--cover';
}
if ( ! empty( $a['justify'] ) ) {
	$classes[] = 'kit-cell--flex';
}
if ( $uid ) {
	$classes[] = $uid;
}

$wrapper = get_block_wrapper_attributes( array( 'class' => implode( ' ', $classes ) ) );

// K-2b: inside a list split (context kit/listTag ul|ol) the cell is the list item.
$list = isset( $block->context['kit/listTag'] ) && in_array( $block->context['kit/listTag'], array( 'ul', 'ol' ), true );
$tag  = $list ? 'li' : 'div';

printf( '<%1$s %2$s>%3$s</%1$s>', $tag, $wrapper, $content );
