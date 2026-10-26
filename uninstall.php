<?php
/**
 * Uninstall Vibery Blocks. Content (post_content) is never touched: the blocks survive in the database by
 * design. We remove only what the plugin itself created: the per-post compiled-CSS cache. Ejected pages keep
 * their baked Additional CSS and the before-image meta (so a later reinstall can still revert them).
 */
defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

global $wpdb;
$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->postmeta} WHERE meta_key = %s", '_vibery_blocks_css' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
