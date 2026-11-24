/* Vibery Blocks motion — editor: "Motion" panel on every block + a Preview toggle that replays the reveal in the canvas. */
( function ( wp ) {
	var el = wp.element.createElement, __ = wp.i18n.__, hooks = wp.hooks, C = wp.components, be = wp.blockEditor || wp.editor;
	var KEY = 'vbMotion';
	var REVEAL = [ [ '', __( 'None', 'vibery-blocks' ) ], [ 'fade', __( 'Fade', 'vibery-blocks' ) ], [ 'up', __( 'Rise', 'vibery-blocks' ) ], [ 'down', __( 'Drop', 'vibery-blocks' ) ], [ 'left', __( 'From right', 'vibery-blocks' ) ], [ 'right', __( 'From left', 'vibery-blocks' ) ], [ 'zoom', __( 'Zoom in', 'vibery-blocks' ) ] ];
	var HOVER = [ [ '', __( 'None', 'vibery-blocks' ) ], [ 'lift', __( 'Lift', 'vibery-blocks' ) ], [ 'zoom', __( 'Zoom', 'vibery-blocks' ) ], [ 'glow', __( 'Glow', 'vibery-blocks' ) ], [ 'dim', __( 'Dim', 'vibery-blocks' ) ] ];
	var EASE = [ [ '', __( 'Soft (default)', 'vibery-blocks' ) ], [ 'snappy', __( 'Snappy', 'vibery-blocks' ) ], [ 'spring', __( 'Spring', 'vibery-blocks' ) ] ];
	var opts = function ( a ) { return a.map( function ( o ) { return { value: o[ 0 ], label: o[ 1 ] }; } ); };

	// preview state (editor only, not saved)
	var store = wp.data.createReduxStore( 'vibery/motion', {
		reducer: function ( s, a ) { s = s || { on: false, n: 0 }; if ( a.type === 'TOGGLE' ) { return { on: ! s.on, n: s.n + 1 }; } if ( a.type === 'REPLAY' ) { return { on: true, n: s.n + 1 }; } return s; },
		actions: { toggle: function () { return { type: 'TOGGLE' }; }, replay: function () { return { type: 'REPLAY' }; } },
		selectors: { get: function ( s ) { return s; } }
	} );
	if ( ! wp.data.select( 'vibery/motion' ) ) { wp.data.register( store ); }

	hooks.addFilter( 'blocks.registerBlockType', 'vibery/motion-attr', function ( s ) {
		s.attributes = Object.assign( {}, s.attributes, { vbMotion: { type: 'object' } } );
		return s;
	} );

	var withControls = wp.compose.createHigherOrderComponent( function ( Edit ) {
		return function ( props ) {
			var m = props.attributes[ KEY ] || {};
			var set = function ( k, v ) {
				var n = Object.assign( {}, m );
				if ( v === '' || v === undefined || v === null || Number.isNaN( v ) ) { delete n[ k ]; } else { n[ k ] = v; }
				props.setAttributes( { vbMotion: Object.keys( n ).length ? n : undefined } );
				wp.data.dispatch( 'vibery/motion' ).replay();
			};
			var num = function ( k, label, min, max, step ) {
				return el( C.RangeControl, { label: label, value: m[ k ], min: min, max: max, step: step, allowReset: true, resetFallbackValue: undefined, onChange: function ( v ) { set( k, v ); }, __nextHasNoMarginBottom: true } );
			};
			var on = wp.data.useSelect( function ( s ) { return s( 'vibery/motion' ).get().on; }, [] );
			return el( wp.element.Fragment, null, el( Edit, props ),
				el( be.InspectorControls, null,
					el( C.PanelBody, { title: __( 'Motion', 'vibery-blocks' ), initialOpen: !! ( m.reveal || m.hover || m.stagger ) },
						el( C.SelectControl, { label: __( 'Reveal on scroll', 'vibery-blocks' ), value: m.reveal || '', options: opts( REVEAL ), onChange: function ( v ) { set( 'reveal', v ); }, __nextHasNoMarginBottom: true } ),
						el( C.SelectControl, { label: __( 'Hover effect', 'vibery-blocks' ), value: m.hover || '', options: opts( HOVER ), onChange: function ( v ) { set( 'hover', v ); }, __nextHasNoMarginBottom: true } ),
						el( C.SelectControl, { label: __( 'Easing', 'vibery-blocks' ), value: m.ease || '', options: opts( EASE ), onChange: function ( v ) { set( 'ease', v ); }, __nextHasNoMarginBottom: true } ),
						num( 'dur', __( 'Duration (ms)', 'vibery-blocks' ), 150, 1500, 50 ),
						num( 'delay', __( 'Delay (ms)', 'vibery-blocks' ), 0, 2000, 50 ),
						num( 'stagger', __( 'Stagger children (ms)', 'vibery-blocks' ), 20, 400, 10 ),
						el( C.ToggleControl, { label: __( 'Preview motion in editor', 'vibery-blocks' ), checked: on, onChange: function () { wp.data.dispatch( 'vibery/motion' ).toggle(); }, __nextHasNoMarginBottom: true } ),
						el( C.Button, { variant: 'secondary', onClick: function () { wp.data.dispatch( 'vibery/motion' ).replay(); } }, __( 'Replay', 'vibery-blocks' ) )
					)
				)
			);
		};
	}, 'withVbMotionControls' );
	hooks.addFilter( 'editor.BlockEdit', 'vibery/motion-controls', withControls );

	// canvas: carry the same classes/vars the front end gets; when Preview is on, reveals replay via a swapped class
	var withClasses = wp.compose.createHigherOrderComponent( function ( BlockListBlock ) {
		return function ( props ) {
			var m = props.attributes && props.attributes[ KEY ];
			var st = wp.data.useSelect( function ( s ) { return s( 'vibery/motion' ).get(); }, [] );
			if ( ! m ) { return el( BlockListBlock, props ); }
			var cls = [ 'vb-m' ];
			[ 'reveal:vb-r-', 'hover:vb-h-', 'ease:vb-e-' ].forEach( function ( p ) { var a = p.split( ':' ); if ( m[ a[ 0 ] ] ) { cls.push( a[ 1 ] + m[ a[ 0 ] ] ); } } );
			if ( m.stagger ) { cls.push( 'vb-stagger' ); }
			if ( st.on && m.reveal ) { cls.push( st.n % 2 ? 'vb-edit-a' : 'vb-edit-b' ); }
			var style = {};
			if ( m.dur ) { style[ '--vb-dur' ] = m.dur + 'ms'; }
			if ( m.delay ) { style[ '--vb-delay' ] = m.delay + 'ms'; }
			if ( m.stagger ) { style[ '--vb-step' ] = m.stagger + 'ms'; }
			var w = Object.assign( {}, props.wrapperProps, { style: Object.assign( {}, props.wrapperProps && props.wrapperProps.style, style ) } );
			return el( BlockListBlock, Object.assign( {}, props, { className: [ props.className ].concat( cls ).filter( Boolean ).join( ' ' ), wrapperProps: w } ) );
		};
	}, 'withVbMotionClasses' );
	hooks.addFilter( 'editor.BlockListBlock', 'vibery/motion-classes', withClasses );
} )( window.wp );
