<?php
/**
 * kit/split — DYNAMIC render (E12). CSS-grid row, never core/columns. save() emits only the kit/cell
 * InnerBlocks, so there is no markup-validation -> no "invalid content" in the editor. The grid layout
 * (display:grid, grid-template-columns, gap, valign, the stack media query) is emitted by
 * includes/compiler.php keyed on the block's uniqueId (.kc-N); render.php lays down the wrapper + the
 * stable hooks the compiler/stylesheet select on (.kit-split, .kit-split--stack-*, data-stack-at).
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

// the stack class lets the ~40-line stylesheet target a non-default stack breakpoint (mirror of the
// converter + the old save()). stackAt '' => never stack; a px value => kit-split--stack-N.
$stack_at = isset( $a['stackAt'] ) ? (string) $a['stackAt'] : '782px';
if ( '' === $stack_at ) {
	$stack_class = 'kit-split--nostack';
} elseif ( preg_match( '/^(\d+)px$/', $stack_at, $m ) ) {
	$stack_class = 'kit-split--stack-' . $m[1];
} else {
	$stack_class = 'kit-split--stack-782';
	$stack_at    = '782px';
}

$classes = trim( 'wp-block-kit-split kit-split ' . $stack_class . ' ' . $uid );
$wrapper = get_block_wrapper_attributes( array(
	'class'        => $classes,
	'data-stack-at' => $stack_at,
) );

printf( '<div %1$s>%2$s</div>', $wrapper, $content );
