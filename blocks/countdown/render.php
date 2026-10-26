<?php
/**
 * kit/countdown — DYNAMIC render + the FIRST BEHAVIORAL kit block (E14).
 *
 * save() emits NOTHING (server-rendered) -> no markup-vs-save() comparison -> never "invalid content"
 * in the editor (E12 law). render.php lays down the transcribed countdown EXACTLY as the frozen kit/cell
 * spike did (row of 4 .kit-cd-item circles + 3 .kit-cd-colon, days/hours/min/sec labels), but here the
 * 4 numbers are COMPUTED from targetDate at render time — so first-paint / no-JS / editor all show a
 * sensible static state, never 07:00:00:01-baked or blank.
 *
 * view.js (viewScript) then ticks the .kit-cd-num text nodes every second on the FRONTEND ONLY. The
 * editor never loads viewScript, so the editor shows the styled static layout and does NOT tick (correct).
 *
 * The block is SELF-STYLED: it emits its own scoped <style> keyed on its uniqueId (.kc-N), so it does not
 * depend on the layout compiler (band/split/cell) — a clean, copyable template for the behavioral blocks.
 *
 * @var array    $attributes
 * @var string   $content
 * @var WP_Block $block
 */
defined( 'ABSPATH' ) || exit;

$a = is_array( $attributes ) ? $attributes : array();

/* uniqueId scope (.kc-N) — same grammar the rest of the runtime uses. Fallback to a content hash so two
 * countdowns on one page never share a scope even if the converter forgot to assign one. */
$uid = '';
if ( ! empty( $a['uniqueId'] ) && preg_match( '/^kc-\d+$/', (string) $a['uniqueId'] ) ) {
	$uid = $a['uniqueId'];
} else {
	$uid = 'kcd-' . substr( md5( wp_json_encode( $a ) ), 0, 8 );
}

/* ---- resolve target epoch (ms) -----------------------------------------------------------------------
 * targetDate is EITHER an ISO-8601 absolute ("2026-06-18T00:00:00Z") OR a duration shorthand
 * ("7d","12h","90m","3d12h") anchored to NOW at render time so the demo always shows a FUTURE target. */
if ( ! function_exists( 'kit_cd_target_ms' ) ) {
function kit_cd_target_ms( $spec ) {
	$spec = trim( (string) $spec );
	if ( $spec === '' ) { $spec = '7d'; }
	// duration shorthand: one or more <int><d|h|m|s> tokens
	if ( preg_match( '/^(\d+[dhms])+$/', $spec ) ) {
		$secs = 0;
		if ( preg_match_all( '/(\d+)([dhms])/', $spec, $mm, PREG_SET_ORDER ) ) {
			$mult = array( 'd' => 86400, 'h' => 3600, 'm' => 60, 's' => 1 );
			foreach ( $mm as $t ) { $secs += (int) $t[1] * $mult[ $t[2] ]; }
		}
		return ( time() + $secs ) * 1000;
	}
	// absolute ISO date
	$ts = strtotime( $spec );
	if ( $ts !== false ) { return $ts * 1000; }
	return ( time() + 7 * 86400 ) * 1000; // safe future fallback
}
}

$target_ms = kit_cd_target_ms( $a['targetDate'] ?? '7d' );
$remain    = max( 0, (int) floor( ( $target_ms / 1000 ) - time() ) ); // seconds remaining

$d = (int) floor( $remain / 86400 );
$h = (int) floor( ( $remain % 86400 ) / 3600 );
$m = (int) floor( ( $remain % 3600 ) / 60 );
$s = (int) ( $remain % 60 );
$vals = array( $d, $h, $m, $s );

/* labels (days,hours,min,sec) */
$labels = array_map( 'trim', explode( ',', (string) ( $a['labels'] ?? 'days,hours,min,sec' ) ) );
$labels = array_pad( array_slice( $labels, 0, 4 ), 4, '' );

/* ---- scoped styling (transcribed look) ---------------------------------------------------------------
 * Validated/whitelisted via simple grammars; emitted as a scoped <style> so the block carries its own
 * appearance (copyable template). Matches the E10/E11 frozen spike exactly. */
$v_len = function ( $x, $fallback ) {
	$x = trim( (string) $x );
	return preg_match( '/^\d*\.?\d+(px|rem|em|%)$/', $x ) ? $x : $fallback;
};
$v_col = function ( $x, $fallback ) {
	$x = trim( (string) $x );
	if ( preg_match( '/^#[0-9a-fA-F]{3,8}$/', $x ) ) { return $x; }
	if ( preg_match( '/^(rgb|rgba|hsl|hsla)\([0-9.,%\s\/]+\)$/', $x ) ) { return $x; }
	return $fallback;
};
$numColor   = $v_col( $a['numColor']   ?? '', 'rgb(83, 125, 93)' );
$labelColor = $v_col( $a['labelColor'] ?? '', 'rgb(153, 153, 153)' );
$numSize    = $v_len( $a['numSize']    ?? '', '22px' );
$labelSize  = $v_len( $a['labelSize']  ?? '', '11px' );
$colSize    = $v_len( $a['colSize']    ?? '', '32px' );
$cellW      = $v_len( $a['cellWidth']  ?? '', '62px' );
$maxW       = $v_len( $a['maxWidth']   ?? '', '314px' );

$sel = '.' . $uid;
$style  = "{$sel}{display:grid;grid-template-columns:{$cellW} auto {$cellW} auto {$cellW} auto {$cellW};";
$style .= "justify-content:center;align-items:start;max-width:{$maxW};margin-left:auto;margin-right:auto}";
$style .= "{$sel} .kit-cd-item{display:flex;flex-direction:column;align-items:center;justify-content:flex-start}";
$style .= "{$sel} .kit-cd-num{color:{$numColor};font-size:{$numSize};font-weight:500;line-height:1.4;margin:0 0 6px}";
$style .= "{$sel} .kit-cd-label{color:{$labelColor};font-size:{$labelSize};margin:0}";
$style .= "{$sel} .kit-cd-colon{display:flex;align-items:flex-start;justify-content:center;";
$style .= "font-size:{$colSize};color:{$labelColor};line-height:62px;margin:0}";

/* ---- markup ------------------------------------------------------------------------------------------ */
$wrapper = get_block_wrapper_attributes( array(
	'class'        => 'kit-cd ' . $uid,
	'data-target'  => (string) $target_ms,            // absolute epoch ms -> view.js ticks against this
	'role'         => 'timer',
	'aria-live'    => 'off',
) );

$cells = '';
foreach ( $vals as $i => $val ) {
	$num   = str_pad( (string) $val, 2, '0', STR_PAD_LEFT );
	$label = esc_html( $labels[ $i ] );
	$cells .= sprintf(
		'<div class="kit-cd-item"><h4 class="wp-block-heading kit-cd-num" data-unit="%1$s">%2$s</h4><p class="kit-cd-label">%3$s</p></div>',
		array( 'd', 'h', 'm', 's' )[ $i ],
		esc_html( $num ),
		$label
	);
	if ( $i < 3 ) {
		$cells .= '<div class="kit-cd-colon"><span>:</span></div>';
	}
}

printf(
	'<style>%1$s</style><div %2$s>%3$s</div>',
	$style, // built from whitelisted values only
	$wrapper,
	$cells
);
