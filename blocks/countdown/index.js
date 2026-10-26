( function ( wp ) {
	'use strict';
	var el = wp.element.createElement;
	var __ = wp.i18n.__;
	var be = wp.blockEditor;
	var cmp = wp.components;

	function pad( n ) { return ( n < 10 ? '0' : '' ) + n; }

	// EDITOR = styled STATIC layout, faithful per E13, NO ticking (viewScript never loads in the editor).
	// We compute one static frame from targetDate so the editor shows sensible digits, not 00:00:00:00.
	function computeVals( spec ) {
		spec = ( spec || '7d' ).trim();
		var secs = 0, now = Math.floor( Date.now() / 1000 ), target;
		if ( /^(\d+[dhms])+$/.test( spec ) ) {
			var mult = { d: 86400, h: 3600, m: 60, s: 1 }, re = /(\d+)([dhms])/g, mm;
			while ( ( mm = re.exec( spec ) ) ) { secs += parseInt( mm[ 1 ], 10 ) * mult[ mm[ 2 ] ]; }
			target = now + secs;
		} else {
			var t = Date.parse( spec );
			target = isNaN( t ) ? now + 7 * 86400 : Math.floor( t / 1000 );
		}
		var rem = Math.max( 0, target - now );
		return [ Math.floor( rem / 86400 ), Math.floor( ( rem % 86400 ) / 3600 ),
			Math.floor( ( rem % 3600 ) / 60 ), rem % 60 ];
	}

	function cdStyle( a ) {
		return {
			display: 'grid',
			gridTemplateColumns: a.cellWidth + ' auto ' + a.cellWidth + ' auto ' + a.cellWidth + ' auto ' + a.cellWidth,
			justifyContent: 'center', alignItems: 'start',
			maxWidth: a.maxWidth, marginLeft: 'auto', marginRight: 'auto'
		};
	}

	wp.blocks.registerBlockType( 'kit/countdown', {
		edit: function ( props ) {
			var a = props.attributes;
			var vals = computeVals( a.targetDate );
			var labels = ( a.labels || 'days,hours,min,sec' ).split( ',' );
			var units = [ 'd', 'h', 'm', 's' ];
			var blockProps = be.useBlockProps( { className: 'kit-cd', style: cdStyle( a ) } );

			var children = [];
			for ( var i = 0; i < 4; i++ ) {
				children.push( el( 'div', { className: 'kit-cd-item', key: 'i' + i },
					el( 'h4', {
						className: 'wp-block-heading kit-cd-num', 'data-unit': units[ i ],
						style: { color: a.numColor, fontSize: a.numSize, fontWeight: 500, lineHeight: 1.4, margin: '0 0 6px' }
					}, pad( vals[ i ] ) ),
					el( 'p', { className: 'kit-cd-label', style: { color: a.labelColor, fontSize: a.labelSize, margin: 0 } },
						( labels[ i ] || '' ).trim() )
				) );
				if ( i < 3 ) {
					children.push( el( 'div', {
						className: 'kit-cd-colon', key: 'c' + i,
						style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'center', fontSize: a.colSize, color: a.labelColor, lineHeight: '62px', margin: 0 }
					}, ':' ) );
				}
			}

			return el( wp.element.Fragment, {},
				el( be.InspectorControls, {},
					el( cmp.PanelBody, { title: __( 'Countdown', 'vibery-blocks' ), initialOpen: true },
						el( cmp.TextControl, {
							label: __( 'Target (ISO date or 7d/12h/90m)', 'vibery-blocks' ),
							value: a.targetDate, onChange: function ( v ) { props.setAttributes( { targetDate: v } ); }
						} ),
						el( cmp.TextControl, {
							label: __( 'Labels (days,hours,min,sec)', 'vibery-blocks' ),
							value: a.labels, onChange: function ( v ) { props.setAttributes( { labels: v } ); }
						} )
					)
				),
				el( 'div', blockProps, children )
			);
		},
		// SERVER-RENDERED: save() emits nothing -> no invalid-content (E12). render.php reproduces this layout
		// + the live data-target; view.js ticks it on the frontend only.
		save: function () { return null; }
	} );
}( window.wp ) );
