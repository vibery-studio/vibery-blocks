<?php
/**
 * vibery-blocks PHP tests — run inside a real WordPress (they need KSES + the style engine):
 *   dev/wp.sh eval-file /var/www/html/wp-content/plugins/vibery-blocks/tests/php/run.php
 * Prints one line per failure and a final PASS/FAIL count; exits non-zero on failure.
 */
$failures = array(); $n = 0;
$t = function ( $cond, $msg ) use ( &$failures, &$n ) { $n++; if ( ! $cond ) { $failures[] = $msg; } };

/* ---- typed validators: hostile values are dropped, never interpolated ------------------------------------ */
$t( '56px' === vibery_blocks_v_length( '56px' ), 'length px' );
$t( '' === vibery_blocks_v_length( '1px;}body{display:none' ), 'length: injection dropped' );
$t( '' === vibery_blocks_v_length( 'url(javascript:alert(1))' ), 'length: url dropped' );
$t( 'clamp(1rem,2vw,3rem)' === vibery_blocks_v_length( 'clamp(1rem,2vw,3rem)' ), 'length clamp' );
$t( '' === vibery_blocks_v_length( 'calc(1px;}</style><script>)' ), 'length: calc with ;}<  dropped' );
$t( '1fr 2fr' === vibery_blocks_v_length_list( '1fr 2fr' ), 'length_list cols' );
$t( '' === vibery_blocks_v_length_list( '1fr; background:url(x)' ), 'length_list: ; dropped' );
$t( '' === vibery_blocks_v_length_list( '1fr url(x)' ), 'length_list: url dropped' );
$t( '' === vibery_blocks_v_length_list( '1fr expression(alert(1))' ), 'length_list: expression dropped' );
$t( '#abc' === vibery_blocks_v_color( '#abc' ), 'color hex' );
$t( '' === vibery_blocks_v_color( 'red;}' ), 'color: injection dropped' );
$t( 'var(--wp--preset--color--accent)' === vibery_blocks_v_color( 'var(--wp--preset--color--accent)' ), 'color preset var' );
$t( '' === vibery_blocks_v_color( 'var(--evil)' ), 'color: arbitrary var dropped' );
$t( '' === vibery_blocks_v_url( 'javascript:alert(1)' ), 'url: javascript: dropped' );
$t( '' === vibery_blocks_v_url( 'data:text/html,x' ), 'url: data: dropped' );
$t( 'https://e.test/a.png' === vibery_blocks_v_url( 'https://e.test/a.png' ), 'url https' );
$t( '' === vibery_blocks_v_overlay( 'url(https://e.test/x.png)' ), 'overlay: url() dropped (gradient or colour only)' );
$t( '' !== vibery_blocks_v_overlay( 'linear-gradient(90deg, #000, #fff)' ), 'overlay gradient' );
$t( '' === vibery_blocks_v_overlay( 'linear-gradient(red);}</style>' ), 'overlay: breakout dropped' );
$t( 'center' === vibery_blocks_v_enum( 'center', array( 'center', 'start' ) ) && '' === vibery_blocks_v_enum( 'x', array( 'center' ) ), 'enum' );

/* ---- residue (kitCss) property/value whitelist ------------------------------------------------------------ */
$t( 'margin-top:10px;color:#fff' === vibery_blocks_residue_decls( 'margin-top:10px;color:#fff' ), 'residue: allowed props kept' );
$t( '' === vibery_blocks_residue_decls( 'background-image:url(http://x/y.png)' ), 'residue: background-image dropped' );
$t( '' === vibery_blocks_residue_decls( 'width:expression(alert(1))' ), 'residue: expression dropped' );
$t( '' === vibery_blocks_residue_decls( 'color:red !important' ), 'residue: !important dropped' );
$t( '' === vibery_blocks_residue_decls( 'position:fixed' ), 'residue: position:fixed dropped' );
$t( 'position:absolute' === vibery_blocks_residue_decls( 'position:absolute' ), 'residue: position:absolute kept' );
$t( '' === vibery_blocks_residue_decls( 'behavior:url(x.htc)' ), 'residue: unknown prop dropped' );
$t( '' === vibery_blocks_residue_decls( 'color:red;}body{display:none' ) || false === strpos( vibery_blocks_residue_decls( 'color:red;}body{display:none' ), '}' ), 'residue: no brace survives' );
$t( '' === vibery_blocks_residue_decls( '@import url(x)' ), 'residue: @import dropped' );
$t( '' === vibery_blocks_residue_decls( 'margin:0\;x' ), 'residue: backslash dropped' );
$t( '' === vibery_blocks_residue_decls( 'display:flex;content:"x"' ) || 'display:flex' === vibery_blocks_residue_decls( 'display:flex;content:"x"' ), 'residue: content: not allowed' );
$t( strlen( vibery_blocks_residue_decls( str_repeat( 'margin:1px;', 1000 ) ) ) <= 2000, 'residue: bounded length' );

/* ---- compile a HOSTILE post: nothing breaks out of the stylesheet ------------------------------------------ */
$hostile = '<!-- wp:kit/band {"uniqueId":"kc-9301","contentMax":"1px;}</style><script>alert(1)</script>","overlay":"url(javascript:alert(1))","bgImageUrl":"javascript:alert(1)","minHeight":"expression(alert(1))","kitCss":"x{margin-top:5px;background:url(https://evil.test/x.png);position:fixed;top:0}"} -->'
	. '<!-- wp:kit/split {"uniqueId":"kc-9302","cols":"1fr;}body{display:none","gap":"</style>","valign":"; evil","stackAt":"1px){}@import url(x);("} -->'
	. '<!-- wp:kit/cell {"uniqueId":"kc-9303;}","pad":"1px;}x{","justify":"; z"} --><!-- wp:paragraph --><p>x</p><!-- /wp:paragraph --><!-- /wp:kit/cell -->'
	. '<!-- /wp:kit/split --><!-- /wp:kit/band -->';
$pid = wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'draft', 'post_title' => 'vb-php-hostile', 'post_content' => wp_slash( $hostile ) ) );
$css = vibery_blocks_compile_post( $pid );
$t( is_string( $css ) && '' !== $css, 'hostile: compiled something' );
foreach ( array( '<', 'javascript', 'expression', '@import', 'evil.test', 'position:fixed', 'url(' ) as $bad ) {
	$t( false === stripos( $css, $bad ), "hostile CSS contains '$bad': " . substr( $css, 0, 400 ) );
}
$t( 1 === substr_count( $css, '{' ) - substr_count( $css, '}' ) + 1 || substr_count( $css, '{' ) === substr_count( $css, '}' ), 'hostile: braces balanced' );
$t( false === strpos( $css, 'kc-9303;' ), 'hostile: malformed uniqueId not used as a selector' );
$t( false !== strpos( $css, '.kc-9301.kc-9301' ), 'hostile: valid uniqueId still compiled' );
// kitCss residue was scoped to the block's own selector and filtered
$t( false !== strpos( $css, 'margin-top:5px' ), 'hostile: allowed residue decl kept' );

/* ---- cache key: pluginVer:globalStylesHash:postModified ------------------------------------------------------ */
$meta = get_post_meta( $pid, '_vibery_blocks_css', true );
$parts = is_array( $meta ) ? explode( ':', $meta['k'] ) : array();
$t( 3 === count( $parts ) && VIBERY_BLOCKS_VER === $parts[0] && 32 === strlen( $parts[1] ), 'cache key shape ver:md5:modified (' . ( $meta['k'] ?? 'none' ) . ')' );
$k1 = $meta['k'];
sleep( 1 );
wp_update_post( array( 'ID' => $pid, 'post_content' => wp_slash( $hostile . '<!-- wp:paragraph --><p>edit</p><!-- /wp:paragraph -->' ) ) );
vibery_blocks_compile_post( $pid );
$k2 = get_post_meta( $pid, '_vibery_blocks_css', true )['k'] ?? '';
$t( $k1 !== $k2 && '' !== $k2, 'cache key changes when the post is modified' );
$cached = get_post_meta( $pid, '_vibery_blocks_css', true );
$t( vibery_blocks_compile_post( $pid ) === $cached['css'], 'second compile returns the cached css' );

/* ---- completeness: every declaration the compiler asks for survives KSES + the style engine on THIS core ----------- */
$full = '<!-- wp:kit/band {"uniqueId":"kc-9401","minHeight":"300px","contentMax":"900px","overlay":"linear-gradient(90deg,#000,#fff)","bgImageUrl":"https://e.test/a.png"} -->'
	. '<!-- wp:kit/split {"uniqueId":"kc-9402","cols":"1fr 1fr","gap":"20px","rowGap":"10px","valign":"center","stackAt":"700px"} -->'
	. '<!-- wp:kit/cell {"uniqueId":"kc-9403","pad":"8px","justify":"center","type":"cover-image"} --><!-- wp:paragraph --><p>x</p><!-- /wp:paragraph --><!-- /wp:kit/cell -->'
	. '<!-- /wp:kit/split --><!-- /wp:kit/band -->';
$fid = wp_insert_post( array( 'post_type' => 'page', 'post_status' => 'draft', 'post_title' => 'vb-php-full', 'post_content' => wp_slash( $full ) ) );
$fcss = vibery_blocks_compile_post( $fid );
foreach ( array( 'position:relative', 'width:100%', 'box-sizing:border-box', 'min-height:300px', 'background-image:url(', 'background-size:cover',
	"content:''", 'inset:0', 'pointer-events:none', 'z-index:1', 'max-width:900px', 'margin-inline:auto', 'display:flex', 'flex-direction:column', 'flex:1',
	'display:grid', 'grid-template-columns:1fr 1fr', 'gap:20px', 'row-gap:10px', 'align-items:center', 'min-width:0', 'padding:8px',
	'justify-content:center', 'overflow:hidden', 'object-fit:cover', '@media (max-width:700px)' ) as $decl ) {
	$t( false !== strpos( $fcss, $decl ), "WP " . get_bloginfo( 'version' ) . ": compiled CSS lost '$decl'" );
}
wp_delete_post( $fid, true );

/* ---- eject conversion (pure) ---------------------------------------------------------------------------------- */
$rep = array( 'converted' => array(), 'unsupported' => array() );
$src = parse_blocks( '<!-- wp:kit/band {"tagName":"header","anchor":"top","className":"my-band evil<x>","uniqueId":"kc-5","backgroundColor":"contrast","style":{"spacing":{"padding":{"top":"9px"}}}} --><!-- wp:kit/split {"stackAt":"900px","uniqueId":"kc-6"} --><!-- wp:kit/cell {"type":"cover-image","justify":"center","uniqueId":"kc-7"} --><!-- wp:paragraph --><p>x</p><!-- /wp:paragraph --><!-- /wp:kit/cell --><!-- /wp:kit/split --><!-- /wp:kit/band -->' );
$out = serialize_blocks( Vibery_Blocks_Eject::convert( $src, $rep ) );
$t( 1 === $rep['converted']['kit/band'] && 1 === $rep['converted']['kit/split'] && 1 === $rep['converted']['kit/cell'], 'eject: converted counts' );
$t( false === strpos( $out, 'wp:kit/' ), 'eject: no kit blocks left' );
$t( false !== strpos( $out, '<header id="top" class="wp-block-group kit-band kc-5 my-band">' ) || false !== strpos( $out, 'class="wp-block-group kit-band kc-5' ), 'eject: band -> core/group header with hooks: ' . substr( $out, 0, 300 ) );
$t( false === strpos( $out, 'evil' ), 'eject: unsafe className dropped' );
$t( false === strpos( $out, '"style"' ) && false === strpos( $out, 'backgroundColor' ), 'eject: layout/colour attrs are baked, not carried' );
$t( false !== strpos( $out, 'kit-band__inner' ) && false !== strpos( $out, 'kit-split--stack-900' ) && false !== strpos( $out, 'kit-cell--cover' ) && false !== strpos( $out, 'kit-cell--flex' ), 'eject: structural classes' );
$rep2 = array( 'converted' => array(), 'unsupported' => array() );
Vibery_Blocks_Eject::convert( parse_blocks( '<!-- wp:kit/countdown /-->' ), $rep2 );
$t( 1 === count( $rep2['unsupported'] ) && 'live_script' === $rep2['unsupported'][0]['reason'], 'eject: countdown unsupported' );

/* ---- _vibery_build meta ----------------------------------------------------------------------------------------- */
update_post_meta( $pid, '_vibery_build', array( 'emitter_ver' => '1.2', 'conformance_ver' => 'cv-1', 'ir_id' => 'a<b>', 'x' => 1 ) );
$b = get_post_meta( $pid, '_vibery_build', true );
$t( array( 'emitter_ver', 'conformance_ver', 'ir_id' ) === array_keys( $b ) && 'ab' === $b['ir_id'], '_vibery_build sanitised to its 3 keys' );

/* ---- static: no licence check, no remote call, no eval in plugin code ------------------------------------------- */
$bad = array();
$it = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( VIBERY_BLOCKS_DIR, FilesystemIterator::SKIP_DOTS ) );
foreach ( $it as $f ) {
	$p = $f->getPathname();
	if ( ! preg_match( '/\.(php|js)$/', $p ) || false !== strpos( $p, '/tests/' ) || false !== strpos( $p, '/dev/' ) ) { continue; }
	$s = preg_replace( '#/\*.*?\*/|(?<![:\'"])//[^\n]*#s', '', file_get_contents( $p ) ); // strip comments
	foreach ( array( 'wp_remote_', 'curl_', 'file_get_contents( \'http', 'fsockopen', 'license', 'Licence', 'sellkit', 'eval(', 'unserialize(', 'fetch(', 'XMLHttpRequest' ) as $needle ) {
		if ( false !== stripos( $s, $needle ) ) { $bad[] = basename( $p ) . ' has ' . $needle; }
	}
}
$t( ! $bad, 'static: forbidden constructs in plugin code: ' . implode( ', ', $bad ) );

wp_delete_post( $pid, true );
echo $failures ? 'FAIL ' . count( $failures ) . ' of ' . $n . "\n - " . implode( "\n - ", $failures ) . "\n" : "PASS vibery-blocks php ($n assertions)\n";
exit( $failures ? 1 : 0 );
