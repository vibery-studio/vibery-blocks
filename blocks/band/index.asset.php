<?php
// block.json's editorScript loads with deps=[] unless this file exists -> wp.blocks undefined when
// index.js runs -> registerBlockType never fires ("block not supported" in the editor). Keep it.
return array(
	'dependencies' => array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n' ),
	'version'      => defined( 'VIBERY_BLOCKS_VER' ) ? VIBERY_BLOCKS_VER : '1.0.0',
);
