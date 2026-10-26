( function ( wp ) {
	'use strict';
	var el = wp.element.createElement;
	var __ = wp.i18n.__;
	var be = wp.blockEditor;
	var cmp = wp.components;

	function cellStyle( a ) {
		var s = {};
		if ( a.pad ) { s[ '--kit-cell-pad' ] = a.pad; }
		if ( a.justify ) { s[ '--kit-cell-justify' ] = a.justify; }
		return s;
	}
	function cellClass( a ) {
		var c = 'kit-cell';
		if ( a.type === 'cover-image' ) { c += ' kit-cell--cover'; }
		if ( a.justify ) { c += ' kit-cell--flex'; }
		return c;
	}

	wp.blocks.registerBlockType( 'kit/cell', {
		edit: function ( props ) {
			var a = props.attributes;
			var blockProps = be.useBlockProps( { className: cellClass( a ), style: cellStyle( a ) } );
			var inner = be.useInnerBlocksProps( blockProps, {
				template: [ [ 'core/paragraph', { placeholder: __( 'Cell…', 'kit-blocks' ) } ] ],
			} );
			return el( wp.element.Fragment, {},
				el( be.InspectorControls, {},
					el( cmp.PanelBody, { title: __( 'Cell', 'kit-blocks' ), initialOpen: true },
						el( cmp.SelectControl, {
							label: __( 'Type', 'kit-blocks' ), value: a.type,
							options: [ { label: 'content', value: 'content' }, { label: 'cover-image', value: 'cover-image' } ],
							onChange: function ( v ) { props.setAttributes( { type: v } ); },
						} ),
						el( cmp.TextControl, { label: __( 'Padding', 'kit-blocks' ), value: a.pad, onChange: function ( v ) { props.setAttributes( { pad: v } ); } } ),
						el( cmp.SelectControl, {
							label: __( 'Justify (flex column)', 'kit-blocks' ), value: a.justify,
							options: [ '', 'flex-start', 'center', 'flex-end', 'space-between' ].map( function ( t ) { return { label: t || '(none)', value: t }; } ),
							onChange: function ( v ) { props.setAttributes( { justify: v } ); },
						} )
					)
				),
				el( 'div', inner )
			);
		},
		save: function ( props ) {
			var a = props.attributes;
			var blockProps = be.useBlockProps.save( { className: cellClass( a ), style: cellStyle( a ) } );
			var inner = be.useInnerBlocksProps.save( blockProps );
			return el( 'div', inner );
		},
	} );
}( window.wp ) );
