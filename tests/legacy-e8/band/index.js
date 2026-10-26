( function ( wp ) {
	'use strict';
	var el = wp.element.createElement;
	var __ = wp.i18n.__;
	var be = wp.blockEditor;
	var cmp = wp.components;
	var useBlockProps = be.useBlockProps;
	var useInnerBlocksProps = be.useInnerBlocksProps;
	var InspectorControls = be.InspectorControls;

	// Build the inline --kit-* custom props that carry the load-bearing layout. IDENTICAL in edit and
	// save so the editor preview == the frontend, and so static-save markup survives plugin removal.
	function bandStyle( a ) {
		var s = {};
		if ( a.minHeight ) { s[ '--kit-band-minh' ] = a.minHeight; }
		if ( a.contentMax ) { s[ '--kit-band-max' ] = a.contentMax; }
		if ( a.overlay ) { s[ '--kit-band-overlay' ] = a.overlay; }
		if ( a.bgImageUrl ) {
			s[ '--kit-band-bg' ] = 'url(' + a.bgImageUrl + ')';
			s[ '--kit-band-bgpos' ] = a.bgPosition || 'center center';
			s[ '--kit-band-bgsize' ] = a.bgSize || 'cover';
		}
		return s;
	}

	wp.blocks.registerBlockType( 'kit/band', {
		edit: function ( props ) {
			var a = props.attributes;
			var blockProps = useBlockProps( {
				className: 'kit-band',
				style: bandStyle( a ),
			} );
			var inner = useInnerBlocksProps(
				{ className: 'kit-band__inner' },
				{ template: [ [ 'core/paragraph', { placeholder: __( 'Band content…', 'kit-blocks' ) } ] ] }
			);
			var TagName = a.tagName || 'section';
			return el( wp.element.Fragment, {},
				el( InspectorControls, {},
					el( cmp.PanelBody, { title: __( 'Band', 'kit-blocks' ), initialOpen: true },
						el( cmp.SelectControl, {
							label: __( 'Tag', 'kit-blocks' ), value: a.tagName,
							options: [ 'section', 'div', 'header', 'footer', 'aside' ].map( function ( t ) { return { label: t, value: t }; } ),
							onChange: function ( v ) { props.setAttributes( { tagName: v } ); },
						} ),
						el( cmp.TextControl, { label: __( 'Inner max-width (blank = full-bleed children)', 'kit-blocks' ), value: a.contentMax, onChange: function ( v ) { props.setAttributes( { contentMax: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Min height', 'kit-blocks' ), value: a.minHeight, onChange: function ( v ) { props.setAttributes( { minHeight: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Overlay (CSS background for ::before)', 'kit-blocks' ), value: a.overlay, onChange: function ( v ) { props.setAttributes( { overlay: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Background image URL', 'kit-blocks' ), value: a.bgImageUrl, onChange: function ( v ) { props.setAttributes( { bgImageUrl: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Background position', 'kit-blocks' ), value: a.bgPosition, onChange: function ( v ) { props.setAttributes( { bgPosition: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Background size', 'kit-blocks' ), value: a.bgSize, onChange: function ( v ) { props.setAttributes( { bgSize: v } ); } } )
					)
				),
				el( TagName, blockProps, el( 'div', inner ) )
			);
		},
		save: function ( props ) {
			var a = props.attributes;
			var blockProps = be.useBlockProps.save( {
				className: 'kit-band',
				style: bandStyle( a ),
			} );
			var inner = be.useInnerBlocksProps.save( { className: 'kit-band__inner' } );
			var TagName = a.tagName || 'section';
			return el( TagName, blockProps, el( 'div', inner ) );
		},
	} );
}( window.wp ) );
