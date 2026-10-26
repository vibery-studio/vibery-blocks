( function ( wp ) {
	'use strict';
	var el = wp.element.createElement;
	var __ = wp.i18n.__;
	var be = wp.blockEditor;
	var cmp = wp.components;

	// Inline --kit-* props carry the load-bearing grid. IDENTICAL in edit and save (editor==front,
	// survives plugin removal). The stackAt breakpoint also rides as a data-attr for the stylesheet's
	// media query + as a class so a non-default breakpoint can be targeted.
	function splitStyle( a ) {
		var s = {
			'--kit-split-cols': a.cols || '1fr 1fr',
			'--kit-split-gap': a.gap || '0',
			'--kit-split-stackcols': a.stackCols || '1fr',
		};
		if ( a.rowGap ) { s[ '--kit-split-rowgap' ] = a.rowGap; }
		if ( a.valign && a.valign !== 'stretch' ) { s[ '--kit-split-valign' ] = a.valign; }
		return s;
	}
	function stackClass( a ) {
		// a small discrete set so the one-breakpoint stylesheet can target non-default stack widths
		var at = ( a.stackAt || '782px' ).replace( 'px', '' );
		if ( a.stackAt === '' ) { return 'kit-split--nostack'; }
		return 'kit-split--stack-' + at;
	}

	wp.blocks.registerBlockType( 'kit/split', {
		edit: function ( props ) {
			var a = props.attributes;
			var blockProps = be.useBlockProps( {
				className: 'kit-split ' + stackClass( a ),
				style: splitStyle( a ),
				'data-stack-at': a.stackAt,
			} );
			var inner = be.useInnerBlocksProps( blockProps, {
				allowedBlocks: [ 'kit/cell' ],
				template: [ [ 'kit/cell', {} ], [ 'kit/cell', {} ] ],
				orientation: 'horizontal',
			} );
			return el( wp.element.Fragment, {},
				el( be.InspectorControls, {},
					el( cmp.PanelBody, { title: __( 'Split', 'kit-blocks' ), initialOpen: true },
						el( cmp.TextControl, { label: __( 'Columns (grid-template-columns)', 'kit-blocks' ), value: a.cols, onChange: function ( v ) { props.setAttributes( { cols: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Gap', 'kit-blocks' ), value: a.gap, onChange: function ( v ) { props.setAttributes( { gap: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Row gap', 'kit-blocks' ), value: a.rowGap, onChange: function ( v ) { props.setAttributes( { rowGap: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Stack at (e.g. 782px, blank = never)', 'kit-blocks' ), value: a.stackAt, onChange: function ( v ) { props.setAttributes( { stackAt: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Stack columns', 'kit-blocks' ), value: a.stackCols, onChange: function ( v ) { props.setAttributes( { stackCols: v } ); } } ),
						el( cmp.SelectControl, {
							label: __( 'Vertical align', 'kit-blocks' ), value: a.valign,
							options: [ 'stretch', 'start', 'center', 'end' ].map( function ( t ) { return { label: t, value: t }; } ),
							onChange: function ( v ) { props.setAttributes( { valign: v } ); },
						} )
					)
				),
				el( 'div', inner )
			);
		},
		save: function ( props ) {
			var a = props.attributes;
			var blockProps = be.useBlockProps.save( {
				className: 'kit-split ' + stackClass( a ),
				style: splitStyle( a ),
				'data-stack-at': a.stackAt,
			} );
			var inner = be.useInnerBlocksProps.save( blockProps );
			return el( 'div', inner );
		},
	} );
}( window.wp ) );
