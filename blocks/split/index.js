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
	// E13: the render-time compiler keys per-instance CSS on .kc-N (uniqueId). render.php folds that
	// class onto the FRONTEND wrapper; edit() must do the SAME so the editor-injected compiled sheet
	// (block_editor_settings_all 'styles', compiler.php) selects this block. Without it the editor
	// wrapper has no .kc-N and paints bare (E12 valid-but-unstyled). ONE source of truth: same .kc-N
	// hook in both edit() and render.php, same compiled rule.
	function uidClass( a ) {
		return /^kc-\d+$/.test( a.uniqueId || '' ) ? ' ' + a.uniqueId : '';
	}

	wp.blocks.registerBlockType( 'kit/split', {
		edit: function ( props ) {
			var a = props.attributes;
			var blockProps = be.useBlockProps( {
				className: 'kit-split ' + ( a.wrap ? 'kit-split--wrap' : stackClass( a ) ) + uidClass( a ),
				style: splitStyle( a ),
				'data-stack-at': a.stackAt,
			} );
			var inner = be.useInnerBlocksProps( blockProps, {
				allowedBlocks: [ 'kit/cell', 'kit/layer' ],
				template: [ [ 'kit/cell', {} ], [ 'kit/cell', {} ] ],
				orientation: 'horizontal',
			} );
			return el( wp.element.Fragment, {},
				el( be.InspectorControls, {},
					el( cmp.PanelBody, { title: __( 'Split', 'vibery-blocks' ), initialOpen: true },
						el( cmp.TextControl, { label: __( 'Columns (grid-template-columns)', 'vibery-blocks' ), value: a.cols, onChange: function ( v ) { props.setAttributes( { cols: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Gap', 'vibery-blocks' ), value: a.gap, onChange: function ( v ) { props.setAttributes( { gap: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Row gap', 'vibery-blocks' ), value: a.rowGap, onChange: function ( v ) { props.setAttributes( { rowGap: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Stack at (e.g. 782px, blank = never)', 'vibery-blocks' ), value: a.stackAt, onChange: function ( v ) { props.setAttributes( { stackAt: v } ); } } ),
						el( cmp.TextControl, { label: __( 'Stack columns', 'vibery-blocks' ), value: a.stackCols, onChange: function ( v ) { props.setAttributes( { stackCols: v } ); } } ),
						el( cmp.SelectControl, {
							label: __( 'Vertical align', 'vibery-blocks' ), value: a.valign,
							options: [ 'stretch', 'start', 'center', 'end' ].map( function ( t ) { return { label: t, value: t }; } ),
							onChange: function ( v ) { props.setAttributes( { valign: v } ); },
						} ),
						el( cmp.ToggleControl, { label: __( 'Wrapping row (items keep their width)', 'vibery-blocks' ), checked: !! a.wrap, onChange: function ( v ) { props.setAttributes( { wrap: v } ); } } ),
						a.wrap ? el( cmp.SelectControl, {
							label: __( 'Row alignment', 'vibery-blocks' ), value: a.justify,
							options: [ 'start', 'center', 'end', 'space-between' ].map( function ( t ) { return { label: t, value: t }; } ),
							onChange: function ( v ) { props.setAttributes( { justify: v } ); },
						} ) : null,
						el( cmp.SelectControl, {
							label: __( 'Semantics', 'vibery-blocks' ), value: a.tagName,
							options: [ { label: 'group (div)', value: 'div' }, { label: 'list (ul)', value: 'ul' }, { label: 'numbered list (ol)', value: 'ol' } ],
							onChange: function ( v ) { props.setAttributes( { tagName: v } ); },
						} )
					)
				),
				el( 'div', inner )
			);
		},
		// DYNAMIC (server-rendered) block: save() emits ONLY InnerBlocks.Content (the kit/cell children),
		// NO wrapper. render.php reproduces the grid wrapper + stack class + data-stack-at from the SAME
		// attrs. No saved-markup-vs-save() comparison -> no "invalid content" in the editor (E12).
		save: function () {
			return el( be.InnerBlocks.Content );
		},
		// RELEASED SHAPES (deprecated[]; one test per shape in tests/e2e/editor.mjs):
		//   A  kit-blocks E8 (2026-06): STATIC save, wrapper + inline --kit-* custom props. Migrates to the
		//      current dynamic shape B (attrs only) and mints a .kc-N uniqueId.
		//   B  kit-blocks E12+ / vibery-blocks 1.x: save() = InnerBlocks.Content (this file's save()).
		deprecated: [ {
			attributes: {
			 "cols": {
			  "type": "string",
			  "default": "1fr 1fr"
			 },
			 "gap": {
			  "type": "string",
			  "default": "0"
			 },
			 "rowGap": {
			  "type": "string",
			  "default": ""
			 },
			 "stackAt": {
			  "type": "string",
			  "default": "782px"
			 },
			 "stackCols": {
			  "type": "string",
			  "default": "1fr"
			 },
			 "valign": {
			  "type": "string",
			  "default": "stretch"
			 }
			},
			supports: {
			 "align": false,
			 "anchor": true,
			 "html": false,
			 "className": true,
			 "color": {
			  "background": true
			 },
			 "spacing": {
			  "padding": true
			 }
			},
			save: function ( props ) {
				var a = props.attributes;
				var s = {
					'--kit-split-cols': a.cols || '1fr 1fr',
					'--kit-split-gap': a.gap || '0',
					'--kit-split-stackcols': a.stackCols || '1fr',
				};
				if ( a.rowGap ) { s[ '--kit-split-rowgap' ] = a.rowGap; }
				if ( a.valign && a.valign !== 'stretch' ) { s[ '--kit-split-valign' ] = a.valign; }
				var at = ( a.stackAt || '782px' ).replace( 'px', '' );
				var sc = a.stackAt === '' ? 'kit-split--nostack' : 'kit-split--stack-' + at;
				var blockProps = be.useBlockProps.save( { className: 'kit-split ' + sc, style: s, 'data-stack-at': a.stackAt } );
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
