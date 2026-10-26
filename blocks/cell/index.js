( function ( wp ) {
	'use strict';
	var el = wp.element.createElement;
	var __ = wp.i18n.__;
	var be = wp.blockEditor;
	var cmp = wp.components;

	function cellStyle( a ) {
		var s = {};
		// padding INLINE (single source — survives plugin removal; matches the converter). The old
		// --kit-cell-pad custom prop was dead weight (always shadowed by inline padding). Dropped.
		if ( a.pad ) { s.padding = a.pad; }
		if ( a.justify ) { s[ '--kit-cell-justify' ] = a.justify; }
		return s;
	}
	function cellClass( a ) {
		var c = 'kit-cell';
		if ( a.type === 'cover-image' ) { c += ' kit-cell--cover'; }
		if ( a.justify ) { c += ' kit-cell--flex'; }
		// E13: mirror render.php — fold the compiler's per-instance .kc-N hook onto the editor wrapper
		// so the editor-injected compiled sheet (compiler.php) paints this cell (pad/justify/cover/kitCss).
		if ( /^kc-\d+$/.test( a.uniqueId || '' ) ) { c += ' ' + a.uniqueId; }
		return c;
	}

	wp.blocks.registerBlockType( 'kit/cell', {
		edit: function ( props ) {
			var a = props.attributes;
			var blockProps = be.useBlockProps( { className: cellClass( a ), style: cellStyle( a ) } );
			var inner = be.useInnerBlocksProps( blockProps, {
				template: [ [ 'core/paragraph', { placeholder: __( 'Cell…', 'vibery-blocks' ) } ] ],
			} );
			return el( wp.element.Fragment, {},
				el( be.InspectorControls, {},
					el( cmp.PanelBody, { title: __( 'Cell', 'vibery-blocks' ), initialOpen: true },
						el( cmp.SelectControl, {
							label: __( 'Type', 'vibery-blocks' ), value: a.type,
							options: [ { label: 'content', value: 'content' }, { label: 'cover-image', value: 'cover-image' } ],
							onChange: function ( v ) { props.setAttributes( { type: v } ); },
						} ),
						el( cmp.TextControl, { label: __( 'Padding', 'vibery-blocks' ), value: a.pad, onChange: function ( v ) { props.setAttributes( { pad: v } ); } } ),
						el( cmp.SelectControl, {
							label: __( 'Justify (flex column)', 'vibery-blocks' ), value: a.justify,
							options: [ '', 'flex-start', 'center', 'flex-end', 'space-between' ].map( function ( t ) { return { label: t || '(none)', value: t }; } ),
							onChange: function ( v ) { props.setAttributes( { justify: v } ); },
						} )
					)
				),
				el( 'div', inner )
			);
		},
		// DYNAMIC (server-rendered) block: save() emits ONLY InnerBlocks.Content, NO wrapper. render.php
		// reproduces the cell wrapper (kit-cell, --cover/--flex modifiers) from the SAME attrs. No
		// saved-markup-vs-save() comparison -> no "invalid content" in the editor (E12).
		save: function () {
			return el( be.InnerBlocks.Content );
		},
		// RELEASED SHAPES (deprecated[]; one test per shape in tests/e2e/editor.mjs):
		//   A  kit-blocks E8 (2026-06): STATIC save, wrapper + inline --kit-* custom props. Migrates to the
		//      current dynamic shape B (attrs only) and mints a .kc-N uniqueId.
		//   B  kit-blocks E12+ / vibery-blocks 1.x: save() = InnerBlocks.Content (this file's save()).
		deprecated: [ {
			attributes: {
			 "type": {
			  "type": "string",
			  "default": "content"
			 },
			 "pad": {
			  "type": "string",
			  "default": ""
			 },
			 "justify": {
			  "type": "string",
			  "default": ""
			 }
			},
			supports: {
			 "anchor": true,
			 "html": false,
			 "className": true,
			 "color": {
			  "background": true,
			  "text": true
			 },
			 "spacing": {
			  "padding": true
			 }
			},
			save: function ( props ) {
				var a = props.attributes;
				var s = {};
				if ( a.pad ) { s[ '--kit-cell-pad' ] = a.pad; }
				if ( a.justify ) { s[ '--kit-cell-justify' ] = a.justify; }
				var c = 'kit-cell';
				if ( a.type === 'cover-image' ) { c += ' kit-cell--cover'; }
				if ( a.justify ) { c += ' kit-cell--flex'; }
				var blockProps = be.useBlockProps.save( { className: c, style: s } );
				return el( 'div', be.useInnerBlocksProps.save( blockProps ) );
			},
			migrate: function ( attrs ) {
				// shape A predates the compiler's .kc-N hook: mint one so the migrated block paints.
				attrs.uniqueId = 'kc-' + ( 100000 + Math.floor( Math.random() * 8900000 ) );
				return attrs;
			},
		} ],
	} );
}( window.wp ) );
