/**
 * kit/countdown viewScript — the FIRST agent-authored behavioral block (E14).
 *
 * Loads ONLY on the frontend (WP enqueues viewScript only when the block is on the page; the editor
 * never loads it). Each .kit-cd wrapper carries data-target = absolute epoch ms; we tick once a second,
 * rewrite the four .kit-cd-num text nodes (d/h/m/s), and stop at zero. The server already painted a
 * correct first frame in render.php, so this only keeps it LIVE.
 *
 * Copyable template for the rest of the behavioral blocks: read a data-attr, setInterval, rewrite text,
 * fail-safe (no target -> do nothing).
 */
( function () {
	'use strict';
	function pad( n ) { return n < 10 ? '0' + n : '' + n; }

	function tick( root ) {
		var target = parseInt( root.getAttribute( 'data-target' ), 10 );
		if ( ! target ) { return; }
		var rem = Math.max( 0, Math.floor( ( target - Date.now() ) / 1000 ) );
		var parts = {
			d: Math.floor( rem / 86400 ),
			h: Math.floor( ( rem % 86400 ) / 3600 ),
			m: Math.floor( ( rem % 3600 ) / 60 ),
			s: rem % 60
		};
		root.querySelectorAll( '.kit-cd-num' ).forEach( function ( el ) {
			var u = el.getAttribute( 'data-unit' );
			if ( parts[ u ] != null ) { el.textContent = pad( parts[ u ] ); }
		} );
		return rem;
	}

	function start( root ) {
		if ( root.__kitCd ) { return; }            // guard against double-init
		root.__kitCd = true;
		tick( root );                              // immediate sync (don't wait 1s)
		var id = setInterval( function () {
			if ( tick( root ) === 0 ) { clearInterval( id ); }
		}, 1000 );
	}

	function boot() {
		document.querySelectorAll( '.kit-cd[data-target]' ).forEach( start );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}
}() );
