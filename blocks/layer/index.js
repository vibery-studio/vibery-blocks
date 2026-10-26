( function ( wp ) {
	'use strict';
	var el = wp.element.createElement;
	var __ = wp.i18n.__;
	var be = wp.blockEditor;
	var cmp = wp.components;

	// Same .kc-N hook render.php puts on the front: the editor-injected compiled sheet (compiler.php,
	// block_editor_settings_all) positions the layer identically in the canvas.
	function layerClass( a ) {
		return 'kit-layer' + ( /^kc-\d+$/.test( a.uniqueId || '' ) ? ' ' + a.uniqueId : '' );
	}
	var anchors = [ 'start', 'center', 'end' ].map( function ( t ) { return { label: t, value: t }; } );

	wp.blocks.registerBlockType( 'kit/layer', {
		edit: function ( props ) {
			var a = props.attributes;
			var extra = { className: layerClass( a ) };
			if ( a.decorative ) { extra[ 'aria-hidden' ] = 'true'; }
			var blockProps = be.useBlockProps( extra );
			var inner = be.useInnerBlocksProps( blockProps, {} );
			var text = function ( k, label ) {
				return el( cmp.TextControl, { label: label, value: a[ k ], onChange: function ( v ) { var o = {}; o[ k ] = v; props.setAttributes( o ); } } );
			};
			return el( wp.element.Fragment, {},
				el( be.InspectorControls, {},
					el( cmp.PanelBody, { title: __( 'Layer position', 'vibery-blocks' ), initialOpen: true },
						el( cmp.SelectControl, { label: __( 'Horizontal anchor', 'vibery-blocks' ), value: a.anchorX, options: anchors, onChange: function ( v ) { props.setAttributes( { anchorX: v } ); } } ),
						text( 'x', __( 'Horizontal offset from the anchor', 'vibery-blocks' ) ),
						el( cmp.SelectControl, { label: __( 'Vertical anchor', 'vibery-blocks' ), value: a.anchorY, options: anchors, onChange: function ( v ) { props.setAttributes( { anchorY: v } ); } } ),
						text( 'y', __( 'Vertical offset from the anchor', 'vibery-blocks' ) ),
						text( 'width', __( 'Width (blank = fit content)', 'vibery-blocks' ) ),
						text( 'height', __( 'Height (blank = fit content)', 'vibery-blocks' ) ),
						el( cmp.RangeControl, { label: __( 'Stack order (-1 = behind the content)', 'vibery-blocks' ), value: a.z, min: -1, max: 10, onChange: function ( v ) { props.setAttributes( { z: v } ); } } ),
						el( cmp.ToggleControl, { label: __( 'Decorative (hidden from screen readers)', 'vibery-blocks' ), checked: !! a.decorative, onChange: function ( v ) { props.setAttributes( { decorative: v } ); } } )
					)
				),
				el( 'div', inner )
			);
		},
		// DYNAMIC: save() = InnerBlocks.Content; render.php draws the wrapper. No released static shape exists.
		save: function () {
			return el( be.InnerBlocks.Content );
		},
	} );
}( window.wp ) );
