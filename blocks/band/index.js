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
	// E13: mirror render.php — fold the compiler's per-instance .kc-N hook onto the editor wrapper so
	// the editor-injected compiled sheet (compiler.php / block_editor_settings_all) paints this band.
	function uidClass( a ) {
		return /^kc-\d+$/.test( a.uniqueId || '' ) ? ' ' + a.uniqueId : '';
	}

	wp.blocks.registerBlockType( 'kit/band', {
		edit: function ( props ) {
			var a = props.attributes;
			var blockProps = useBlockProps( {
				className: 'kit-band' + uidClass( a ),
				style: bandStyle( a ),
			} );
			var inner = useInnerBlocksProps(
				{ className: 'kit-band__inner' },
				{ template: [ [ 'core/paragraph', { placeholder: __( 'Band content…', 'vibery-blocks' ) } ] ] }
			);
			var TagName = a.tagName || 'section';
			return el( wp.element.Fragment, {},
				el( InspectorControls, {},
					el( cmp.PanelBody, { title: __( 'Band', 'vibery-blocks' ), initialOpen: true },
						el( cmp.SelectControl, {
							label: __( 'Tag', 'vibery-blocks' ), value: a.tagName,
							options: [ 'section', 'div', 'header', 'footer', 'aside' ].map( function ( t ) { return { label: t, value: t }; } ),
							onChange: function ( v ) { props.setAttributes( { tagName: v } ); },
						} ),
						el( cmp.TextControl, { label: __( 'Inner max-width (blank = full-bleed children)', 'vibery-blocks' ), value: a.contentMax, onChange: function ( v ) { props.setAttributes( { contentMax: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Min height', 'vibery-blocks' ), value: a.minHeight, onChange: function ( v ) { props.setAttributes( { minHeight: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Overlay (CSS background for ::before)', 'vibery-blocks' ), value: a.overlay, onChange: function ( v ) { props.setAttributes( { overlay: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Background image URL', 'vibery-blocks' ), value: a.bgImageUrl, onChange: function ( v ) { props.setAttributes( { bgImageUrl: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Background position', 'vibery-blocks' ), value: a.bgPosition, onChange: function ( v ) { props.setAttributes( { bgPosition: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Background size', 'vibery-blocks' ), value: a.bgSize, onChange: function ( v ) { props.setAttributes( { bgSize: v } ); } } )
					)
				),
				el( TagName, blockProps, el( 'div', inner ) )
			);
		},
		// DYNAMIC (server-rendered) block: save() emits ONLY the InnerBlocks content, NO wrapper. The
		// wrapper <section> + .kit-band__inner is produced by render.php from the SAME attrs the editor
		// edits, so the editor preview (edit()) and the frontend (render.php) agree. With save() emitting
		// only InnerBlocks.Content there is NO saved-markup-vs-save() comparison -> the "Block contains
		// unexpected or invalid content" class CANNOT occur (E12). The compiler still keys CSS on uniqueId.
		save: function () {
			return el( be.InnerBlocks.Content );
		},
		// RELEASED SHAPES (deprecated[]; one test per shape in tests/e2e/editor.mjs):
		//   A  kit-blocks E8 (2026-06): STATIC save, wrapper + inline --kit-* custom props. Migrates to the
		//      current dynamic shape B (attrs only) and mints a .kc-N uniqueId.
		//   B  kit-blocks E12+ / vibery-blocks 1.x: save() = InnerBlocks.Content (this file's save()).
		deprecated: [ {
			attributes: {
			 "tagName": {
			  "type": "string",
			  "default": "section"
			 },
			 "contentMax": {
			  "type": "string",
			  "default": ""
			 },
			 "minHeight": {
			  "type": "string",
			  "default": ""
			 },
			 "bgImageUrl": {
			  "type": "string",
			  "default": ""
			 },
			 "bgImageId": {
			  "type": "number"
			 },
			 "bgPosition": {
			  "type": "string",
			  "default": "center center"
			 },
			 "bgSize": {
			  "type": "string",
			  "default": "cover"
			 },
			 "overlay": {
			  "type": "string",
			  "default": ""
			 }
			},
			supports: {
			 "align": false,
			 "anchor": true,
			 "html": false,
			 "className": true,
			 "color": {
			  "background": true,
			  "text": true,
			  "gradients": true
			 },
			 "spacing": {
			  "padding": true,
			  "margin": [
			   "top",
			   "bottom"
			  ]
			 },
			 "typography": {
			  "fontSize": true,
			  "lineHeight": true
			 }
			},
			save: function ( props ) {
				var a = props.attributes;
				var s = {};
				if ( a.minHeight ) { s[ '--kit-band-minh' ] = a.minHeight; }
				if ( a.contentMax ) { s[ '--kit-band-max' ] = a.contentMax; }
				if ( a.overlay ) { s[ '--kit-band-overlay' ] = a.overlay; }
				if ( a.bgImageUrl ) {
					s[ '--kit-band-bg' ] = 'url(' + a.bgImageUrl + ')';
					s[ '--kit-band-bgpos' ] = a.bgPosition || 'center center';
					s[ '--kit-band-bgsize' ] = a.bgSize || 'cover';
				}
				var blockProps = be.useBlockProps.save( { className: 'kit-band', style: s } );
				var inner = be.useInnerBlocksProps.save( { className: 'kit-band__inner' } );
				return el( a.tagName || 'section', blockProps, el( 'div', inner ) );
			},
			migrate: function ( attrs ) {
				// shape A predates the compiler's .kc-N hook: mint one so the migrated block paints.
				attrs.uniqueId = 'kc-' + ( 100000 + Math.floor( Math.random() * 8900000 ) );
				return attrs;
			},
		} ],
	} );
}( window.wp ) );
