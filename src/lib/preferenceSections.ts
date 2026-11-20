import { t } from '@/i18n'
import type { CustomPref, PrefDef, PrefOption, PrefSection } from './preferences'

// The settings pages' contents: every preference, in qBittorrent's own groups and order. The types
// and the rules for reading and saving them are in preferences.ts.

// Each label is read when it's shown, in the language of the moment, and so is any text among
// the extras: they're copied with their getters, not their values at load.
// A few labels are the same in every language, so they're plain text.
type Label = string | (() => string)
const pref = (fields: Omit<PrefDef, 'label'>, label: Label, extra: Partial<PrefDef>): PrefDef =>
  Object.defineProperties(fields, {
    ...Object.getOwnPropertyDescriptors(extra),
    label: typeof label === 'string' ? { value: label, enumerable: true } : { get: label, enumerable: true },
  }) as PrefDef
const bool = (key: string, label: Label, extra: Partial<PrefDef> = {}): PrefDef => pref({ key, type: 'bool' }, label, extra)
const int = (key: string, label: Label, extra: Partial<PrefDef> = {}): PrefDef => pref({ key, type: 'int' }, label, extra)
const text = (key: string, label: Label, extra: Partial<PrefDef> = {}): PrefDef => pref({ key, type: 'text' }, label, extra)
const path = (key: string, label: Label, extra: Partial<PrefDef> = {}): PrefDef => pref({ key, type: 'path' }, label, extra)
const select = (key: string, label: Label, options: PrefOption[], extra: Partial<PrefDef> = {}): PrefDef => pref({ key, type: 'select', options }, label, extra)
const custom = (key: string, label: Label, kind: CustomPref, extra: Partial<PrefDef> = {}): PrefDef => pref({ key, type: 'custom', custom: kind }, label, extra)

const KIB_PER_SECOND = { unit: 'KiB/s', scale: 1024 }

export const PREFERENCE_SECTIONS: PrefSection[] = [
  {
    id: 'behavior',
    get title() { return t('Behavior') },
    groups: [
      {
        get title() { return t('General') },
        prefs: [
          text('locale', () => t('Language code'), { help: 'For example en, de, or fr. Used by qBittorrent itself.' }),
          bool('performance_warning', () => t('Log performance warnings')),
          bool('status_bar_external_ip', () => t('Show external IP in the status bar')),
          bool('confirm_torrent_deletion', () => t('Confirm when deleting torrents (qBittorrent\'s own interface)')),
          bool('delete_torrent_content_files', () => t('Delete .torrent files along with their torrents')),
          bool('store_search_jobs', () => t('Keep searches after a restart')),
          bool('store_search_job_results', () => t('Keep their results too'), { dependsOn: 'store_search_jobs' }),
        ],
      },
      {
        get title() { return t('Log file') },
        prefs: [
          bool('file_log_enabled', () => t('Save the log to a file')),
          path('file_log_path', () => t('Log folder'), { dependsOn: 'file_log_enabled' }),
          bool('file_log_backup_enabled', () => t('Back up the log after it reaches'), { dependsOn: 'file_log_enabled' }),
          int('file_log_max_size', () => t('Maximum log size'), { unit: 'KiB', dependsOn: 'file_log_backup_enabled' }),
          bool('file_log_delete_old', () => t('Delete backups older than'), { dependsOn: 'file_log_enabled' }),
          int('file_log_age', () => t('Backup age'), { dependsOn: 'file_log_delete_old' }),
          select('file_log_age_type', () => t('Backup age unit'), [{ value: 0, get label() { return t('Days') } }, { value: 1, get label() { return t('Months') } }, { value: 2, get label() { return t('Years') } }], { dependsOn: 'file_log_delete_old' }),
        ],
      },
    ],
  },
  {
    id: 'downloads',
    get title() { return t('Downloads') },
    groups: [
      {
        get title() { return t('When adding a torrent') },
        prefs: [
          select('torrent_content_layout', () => t('Content layout'), [{ value: 'Original', get label() { return t('Original') } }, { value: 'Subfolder', get label() { return t('Create subfolder') } }, { value: 'NoSubfolder', get label() { return t('Don\'t create subfolder') } }]),
          bool('add_to_top_of_queue', () => t('Add to top of queue')),
          bool('add_stopped_enabled', () => t('Don\'t start the download automatically')),
          select('torrent_stop_condition', () => t('Stop condition'), [{ value: 'None', get label() { return t('None') } }, { value: 'MetadataReceived', get label() { return t('Metadata received') } }, { value: 'FilesChecked', get label() { return t('Files checked') } }]),
          bool('merge_trackers', () => t('Merge trackers into an existing torrent')),
          select('auto_delete_mode', () => t('Delete .torrent files afterwards'), [{ value: 0, get label() { return t('Never') } }, { value: 1, get label() { return t('If added successfully') } }, { value: 2, get label() { return t('Always') } }]),
          bool('preallocate_all', () => t('Pre-allocate disk space for all files')),
          bool('incomplete_files_ext', () => t('Append .!qB to incomplete files')),
          bool('use_unwanted_folder', () => t('Keep unselected files in a ".unwanted" folder')),
        ],
      },
      {
        get title() { return t('Saving') },
        prefs: [
          select('auto_tmm_enabled', () => t('Default torrent management mode'), [{ value: 'false', get label() { return t('Manual') } }, { value: 'true', get label() { return t('Automatic') } }]),
          select('torrent_changed_tmm_enabled', () => t('When a torrent\'s category changes'), [{ value: 'true', get label() { return t('Relocate the torrent') } }, { value: 'false', get label() { return t('Switch it to manual mode') } }]),
          select('save_path_changed_tmm_enabled', () => t('When the default save path changes'), [{ value: 'true', get label() { return t('Relocate affected torrents') } }, { value: 'false', get label() { return t('Switch them to manual mode') } }]),
          select('category_changed_tmm_enabled', () => t('When a category\'s save path changes'), [{ value: 'true', get label() { return t('Relocate affected torrents') } }, { value: 'false', get label() { return t('Switch them to manual mode') } }]),
          bool('use_category_paths_in_manual_mode', () => t('Use category paths in manual mode')),
          path('save_path', () => t('Default save path')),
          bool('temp_path_enabled', () => t('Keep incomplete torrents in a separate folder')),
          path('temp_path', () => t('Folder for incomplete torrents'), { dependsOn: 'temp_path_enabled' }),
          path('export_dir', () => t('Copy .torrent files to'), { help: 'Blank turns this off.' }),
          path('export_dir_fin', () => t('Copy .torrent files of finished downloads to'), { help: 'Blank turns this off.' }),
          // qBittorrent 5.3 replaces the two copies above with backups.
          bool('torrent_files_backup_enabled', () => t('Keep backup copies of .torrent files')),
          path('torrent_files_backup_dir', () => t('Backup folder'), { dependsOn: 'torrent_files_backup_enabled' }),
          bool('torrent_files_finished_backup_dir_enabled', () => t('Move backups of finished torrents'), { dependsOn: 'torrent_files_backup_enabled' }),
          path('torrent_files_finished_backup_dir', () => t('Folder for finished backups'), { dependsOn: 'torrent_files_finished_backup_dir_enabled' }),
          bool('remove_torrent_file_backup', () => t('Remove the backup when removing the torrent'), { dependsOn: 'torrent_files_backup_enabled' }),
        ],
      },
      {
        get title() { return t('Watched folders') },
        prefs: [custom('scan_dirs', () => t('Folders to watch for new .torrent files'), 'scanDirs')],
      },
      {
        get title() { return t('Excluded file names') },
        prefs: [
          bool('excluded_file_names_enabled', () => t('Skip files matching these names')),
          { key: 'excluded_file_names', get label() { return t('Names or patterns, one per line') }, type: 'textarea', dependsOn: 'excluded_file_names_enabled' },
        ],
      },
      {
        get title() { return t('Email when a download finishes') },
        prefs: [
          bool('mail_notification_enabled', () => t('Send an email')),
          text('mail_notification_sender', 'From', { dependsOn: 'mail_notification_enabled' }),
          text('mail_notification_email', 'To', { dependsOn: 'mail_notification_enabled' }),
          text('mail_notification_smtp', () => t('SMTP server'), { dependsOn: 'mail_notification_enabled' }),
          bool('mail_notification_ssl_enabled', () => t('Use a secure connection (SSL)'), { dependsOn: 'mail_notification_enabled' }),
          select('mail_notification_encryption_type', 'Encryption', [{ value: 'None', get label() { return t('None (port 25)') } }, { value: 'STARTTLS', get label() { return t('STARTTLS (port 587)') } }, { value: 'SMTPS', get label() { return t('SMTPS (port 465)') } }], { dependsOn: 'mail_notification_enabled' }),
          bool('mail_notification_auth_enabled', () => t('Server needs a login'), { dependsOn: 'mail_notification_enabled' }),
          text('mail_notification_username', 'Username', { dependsOn: 'mail_notification_auth_enabled' }),
          { key: 'mail_notification_password', get label() { return t('Password') }, type: 'password', dependsOn: 'mail_notification_auth_enabled' },
          custom('mail_test', () => t('Test email'), 'testEmail', { dependsOn: 'mail_notification_enabled' }),
        ],
      },
      {
        get title() { return t('Run a program') },
        get warning() { return t('These run commands on the machine where qBittorrent is installed.') },
        prefs: [
          bool('autorun_on_torrent_added_enabled', () => t('When a torrent is added')),
          text('autorun_on_torrent_added_program', 'Command', { dependsOn: 'autorun_on_torrent_added_enabled', help: '%N name, %L category, %G tags, %F content path, %R root path, %D save path, %C file count, %Z size, %T tracker, %I/%J/%K hashes.' }),
          bool('autorun_enabled', () => t('When a torrent finishes')),
          text('autorun_program', 'Command', { dependsOn: 'autorun_enabled' }),
        ],
      },
    ],
  },
  {
    id: 'connection',
    get title() { return t('Connection') },
    groups: [
      {
        get title() { return t('Listening port') },
        prefs: [
          int('listen_port', () => t('Port for incoming connections'), { help: '0 picks a random port.' }),
          bool('upnp', () => t('Use UPnP / NAT-PMP port forwarding from my router')),
          bool('ssl_enabled', () => t('Accept SSL torrent connections')),
          int('ssl_listen_port', () => t('SSL port'), { dependsOn: 'ssl_enabled' }),
        ],
      },
      {
        get title() { return t('Connection limits') },
        prefs: [
          int('max_connec', () => t('Global maximum connections'), { help: '-1 means no limit.' }),
          int('max_connec_per_torrent', () => t('Maximum connections per torrent')),
          int('max_uploads', () => t('Global maximum upload slots')),
          int('max_uploads_per_torrent', () => t('Maximum upload slots per torrent')),
        ],
      },
      {
        title: 'I2P',
        prefs: [
          bool('i2p_enabled', () => t('Use I2P')),
          text('i2p_address', 'Host', { dependsOn: 'i2p_enabled' }),
          int('i2p_port', 'Port', { dependsOn: 'i2p_enabled' }),
          bool('i2p_mixed_mode', () => t('Mixed mode'), { dependsOn: 'i2p_enabled' }),
          bool('i2p_pex_enabled', () => t('Find more peers with I2P peer exchange (needs a restart)'), { dependsOn: 'i2p_enabled' }),
          int('i2p_inbound_quantity', () => t('Inbound tunnels'), { dependsOn: 'i2p_enabled' }),
          int('i2p_outbound_quantity', () => t('Outbound tunnels'), { dependsOn: 'i2p_enabled' }),
          int('i2p_inbound_length', () => t('Inbound tunnel length'), { dependsOn: 'i2p_enabled' }),
          int('i2p_outbound_length', () => t('Outbound tunnel length'), { dependsOn: 'i2p_enabled' }),
          int('i2p_inbound_length_variance', () => t('Inbound tunnel length variance'), { dependsOn: 'i2p_enabled' }),
          int('i2p_outbound_length_variance', () => t('Outbound tunnel length variance'), { dependsOn: 'i2p_enabled' }),
        ],
      },
      {
        get title() { return t('Proxy server') },
        prefs: [
          select('proxy_type', 'Type', [{ value: 'None', get label() { return t('None') } }, { value: 'SOCKS4', label: 'SOCKS4' }, { value: 'SOCKS5', label: 'SOCKS5' }, { value: 'HTTP', label: 'HTTP' }]),
          text('proxy_ip', 'Host'),
          int('proxy_port', 'Port'),
          bool('proxy_auth_enabled', () => t('Proxy needs a login')),
          text('proxy_username', 'Username', { dependsOn: 'proxy_auth_enabled' }),
          { key: 'proxy_password', get label() { return t('Password') }, type: 'password', dependsOn: 'proxy_auth_enabled' },
          bool('proxy_hostname_lookup', () => t('Look up host names through the proxy')),
          bool('proxy_bittorrent', () => t('Use the proxy for BitTorrent')),
          bool('proxy_peer_connections', () => t('Use the proxy for peer connections'), { dependsOn: 'proxy_bittorrent' }),
          bool('proxy_rss', () => t('Use the proxy for RSS')),
          bool('proxy_misc', () => t('Use the proxy for other downloads')),
        ],
      },
      {
        get title() { return t('IP filtering') },
        prefs: [
          bool('ip_filter_enabled', () => t('Use an IP filter file')),
          { key: 'ip_filter_path', get label() { return t('Filter file (.dat, .p2p, .p2b)') }, type: 'file', dependsOn: 'ip_filter_enabled' },
          bool('ip_filter_trackers', () => t('Apply the filter to trackers too'), { dependsOn: 'ip_filter_enabled' }),
          custom('banned_IPs', () => t('Banned peers'), 'bannedPeers'),
        ],
      },
    ],
  },
  {
    id: 'speed',
    get title() { return t('Speed') },
    groups: [
      {
        get title() { return t('Global limits (0 = unlimited)') },
        prefs: [
          int('dl_limit', 'Download', KIB_PER_SECOND),
          int('up_limit', 'Upload', KIB_PER_SECOND),
        ],
      },
      {
        get title() { return t('Alternative limits') },
        prefs: [
          int('alt_dl_limit', 'Download', KIB_PER_SECOND),
          int('alt_up_limit', 'Upload', KIB_PER_SECOND),
          bool('scheduler_enabled', () => t('Use the alternative limits on a schedule')),
          int('schedule_from_hour', () => t('From hour (0-23)'), { dependsOn: 'scheduler_enabled' }),
          int('schedule_from_min', () => t('From minute'), { dependsOn: 'scheduler_enabled' }),
          int('schedule_to_hour', () => t('To hour (0-23)'), { dependsOn: 'scheduler_enabled' }),
          int('schedule_to_min', () => t('To minute'), { dependsOn: 'scheduler_enabled' }),
          select('scheduler_days', 'When', [
            { value: 0, get label() { return t('Every day') } }, { value: 1, get label() { return t('Weekdays') } }, { value: 2, get label() { return t('Weekends') } },
            { value: 3, get label() { return t('Monday') } }, { value: 4, get label() { return t('Tuesday') } }, { value: 5, get label() { return t('Wednesday') } }, { value: 6, get label() { return t('Thursday') } },
            { value: 7, get label() { return t('Friday') } }, { value: 8, get label() { return t('Saturday') } }, { value: 9, get label() { return t('Sunday') } },
          ], { dependsOn: 'scheduler_enabled' }),
        ],
      },
      {
        get title() { return t('Rate limit settings') },
        prefs: [
          select('bittorrent_protocol', () => t('BitTorrent protocol'), [{ value: 0, get label() { return t('TCP and μTP') } }, { value: 1, label: 'TCP' }, { value: 2, label: 'μTP' }]),
          bool('limit_utp_rate', () => t('Apply limits to the μTP protocol')),
          bool('limit_tcp_overhead', () => t('Apply limits to transport overhead')),
          bool('limit_lan_peers', () => t('Apply limits to peers on the local network')),
        ],
      },
    ],
  },
  {
    id: 'bittorrent',
    get title() { return t('BitTorrent') },
    groups: [
      {
        get title() { return t('Privacy') },
        prefs: [
          bool('dht', () => t('Use DHT to find more peers')),
          bool('pex', () => t('Use peer exchange (PeX)')),
          bool('lsd', () => t('Use local peer discovery')),
          select('encryption', 'Encryption', [{ value: 0, get label() { return t('Allow encryption') } }, { value: 1, get label() { return t('Require encryption') } }, { value: 2, get label() { return t('Disable encryption') } }]),
          bool('anonymous_mode', () => t('Anonymous mode')),
          int('max_active_checking_torrents', () => t('Maximum torrents checked at once')),
        ],
      },
      {
        get title() { return t('Queueing') },
        prefs: [
          bool('queueing_enabled', () => t('Use torrent queueing')),
          int('max_active_downloads', () => t('Maximum active downloads'), { dependsOn: 'queueing_enabled' }),
          int('max_active_uploads', () => t('Maximum active uploads'), { dependsOn: 'queueing_enabled' }),
          int('max_active_torrents', () => t('Maximum active torrents'), { dependsOn: 'queueing_enabled' }),
          bool('dont_count_slow_torrents', () => t('Don\'t count slow torrents in these limits'), { dependsOn: 'queueing_enabled' }),
          int('slow_torrent_dl_rate_threshold', () => t('Slow download threshold'), { unit: 'KiB/s', dependsOn: 'dont_count_slow_torrents' }),
          int('slow_torrent_ul_rate_threshold', () => t('Slow upload threshold'), { unit: 'KiB/s', dependsOn: 'dont_count_slow_torrents' }),
          int('slow_torrent_inactive_timer', () => t('Torrent inactivity timer'), { unit: 'seconds', dependsOn: 'dont_count_slow_torrents' }),
        ],
      },
      {
        get title() { return t('Seeding limits') },
        prefs: [
          bool('max_ratio_enabled', () => t('Stop at ratio')),
          { key: 'max_ratio', get label() { return t('Ratio') }, type: 'number', dependsOn: 'max_ratio_enabled' },
          bool('max_seeding_time_enabled', () => t('Stop after seeding for')),
          int('max_seeding_time', () => t('Seeding time'), { unit: 'minutes', dependsOn: 'max_seeding_time_enabled' }),
          bool('max_inactive_seeding_time_enabled', () => t('Stop after being inactive for')),
          int('max_inactive_seeding_time', () => t('Inactive time'), { unit: 'minutes', dependsOn: 'max_inactive_seeding_time_enabled' }),
          select('max_ratio_act', 'Then', [{ value: 0, get label() { return t('Stop torrent') } }, { value: 1, get label() { return t('Remove torrent') } }, { value: 3, get label() { return t('Remove torrent and its files') } }, { value: 2, get label() { return t('Enable super seeding for torrent') } }]),
        ],
      },
      {
        get title() { return t('Add trackers to new downloads') },
        prefs: [
          bool('add_trackers_enabled', () => t('Add these trackers')),
          { key: 'add_trackers', get label() { return t('Trackers, one per line') }, type: 'textarea', dependsOn: 'add_trackers_enabled' },
          bool('add_trackers_from_url_enabled', () => t('Add trackers from a list online')),
          text('add_trackers_url', () => t('List address'), { dependsOn: 'add_trackers_from_url_enabled' }),
          custom('add_trackers_url_list', () => t('Trackers from that list'), 'trackerUrlList', { dependsOn: 'add_trackers_from_url_enabled' }),
        ],
      },
    ],
  },
  {
    id: 'rss',
    title: 'RSS',
    groups: [
      {
        get title() { return t('Reader') },
        prefs: [
          bool('rss_processing_enabled', () => t('Fetch RSS feeds')),
          int('rss_refresh_interval', () => t('Refresh every'), { unit: 'minutes', dependsOn: 'rss_processing_enabled' }),
          int('rss_fetch_delay', () => t('Wait between fetches from the same host'), { unit: 'seconds', dependsOn: 'rss_processing_enabled' }),
          int('rss_max_articles_per_feed', () => t('Maximum articles per feed'), { dependsOn: 'rss_processing_enabled' }),
        ],
      },
      {
        get title() { return t('Automatic downloading') },
        prefs: [
          bool('rss_auto_downloading_enabled', () => t('Download torrents that match the rules')),
          bool('rss_download_repack_proper_episodes', () => t('Download REPACK and PROPER episodes')),
          { key: 'rss_smart_episode_filters', get label() { return t('Smart episode filters, one per line') }, type: 'textarea' },
        ],
      },
    ],
  },
  {
    id: 'webui',
    get title() { return t('Web UI') },
    groups: [
      {
        get title() { return t('Server') },
        get warning() { return t('A wrong address, port, or HTTPS setting can make the Web UI unreachable, including this app.') },
        prefs: [
          text('web_ui_address', () => t('IP address'), { help: '* listens on every address.' }),
          int('web_ui_port', 'Port'),
          bool('web_ui_upnp', () => t('Forward the port with UPnP / NAT-PMP')),
          bool('use_https', () => t('Use HTTPS')),
          { key: 'web_ui_https_cert_path', get label() { return t('Certificate file') }, type: 'file', dependsOn: 'use_https' },
          { key: 'web_ui_https_key_path', get label() { return t('Key file') }, type: 'file', dependsOn: 'use_https' },
        ],
      },
      {
        get title() { return t('Login') },
        get warning() { return t('If you change the username or password, sign in again with the new ones.') },
        prefs: [
          text('web_ui_username', 'Username'),
          custom('web_ui_password', () => t('New password'), 'webUiPassword'),
          bool('bypass_local_auth', () => t('Skip the login for clients on localhost')),
          bool('bypass_auth_subnet_whitelist_enabled', () => t('Skip the login for these networks')),
          { key: 'bypass_auth_subnet_whitelist', get label() { return t('Networks, one per line (such as 192.168.0.0/24)') }, type: 'textarea', dependsOn: 'bypass_auth_subnet_whitelist_enabled' },
          int('web_ui_max_auth_fail_count', () => t('Ban a client after this many failed logins')),
          int('web_ui_ban_duration', () => t('Ban for'), { unit: 'seconds' }),
          int('web_ui_session_timeout', () => t('Sign out after'), { unit: 'seconds' }),
          int('web_ui_sessions_count_limit', () => t('Most signed-in sessions (0 = no limit)')),
          custom('web_ui_api_key', () => t('API key'), 'apiKey'),
        ],
      },
      {
        get title() { return t('Alternative Web UI') },
        get warning() { return t('This app is an alternative Web UI. Turning this off or changing the folder switches qBittorrent away from it.') },
        prefs: [
          bool('alternative_webui_enabled', () => t('Use an alternative Web UI')),
          path('alternative_webui_path', () => t('Files location'), { dependsOn: 'alternative_webui_enabled' }),
        ],
      },
      {
        get title() { return t('Security') },
        prefs: [
          bool('web_ui_clickjacking_protection_enabled', () => t('Clickjacking protection')),
          bool('web_ui_csrf_protection_enabled', () => t('Cross-site request forgery (CSRF) protection')),
          bool('web_ui_secure_cookie_enabled', () => t('Secure cookie flag (needs HTTPS)')),
          bool('web_ui_host_header_validation_enabled', () => t('Check the Host header')),
          text('web_ui_domain_list', () => t('Allowed server domains'), { dependsOn: 'web_ui_host_header_validation_enabled', help: 'Separated by ;. Use * for any.' }),
          bool('web_ui_use_custom_http_headers_enabled', () => t('Add custom HTTP headers')),
          { key: 'web_ui_custom_http_headers', get label() { return t('Headers, one per line') }, type: 'textarea', dependsOn: 'web_ui_use_custom_http_headers_enabled' },
          bool('web_ui_reverse_proxy_enabled', () => t('Support a reverse proxy')),
          text('web_ui_reverse_proxies_list', () => t('Trusted proxies'), { dependsOn: 'web_ui_reverse_proxy_enabled', help: 'IP addresses or networks, separated by ;.' }),
        ],
      },
      {
        get title() { return t('Dynamic DNS') },
        prefs: [
          bool('dyndns_enabled', () => t('Update my dynamic domain name')),
          select('dyndns_service', 'Service', [{ value: 0, get label() { return t('DynDNS') } }, { value: 1, label: 'NO-IP' }], { dependsOn: 'dyndns_enabled' }),
          text('dyndns_domain', () => t('Domain name'), { dependsOn: 'dyndns_enabled' }),
          text('dyndns_username', 'Username', { dependsOn: 'dyndns_enabled' }),
          { key: 'dyndns_password', get label() { return t('Password') }, type: 'password', dependsOn: 'dyndns_enabled' },
        ],
      },
    ],
  },
  {
    id: 'advanced',
    get title() { return t('Advanced') },
    groups: [
      {
        title: 'qBittorrent',
        get warning() { return t('Change these only if you know what they do.') },
        prefs: [
          select('resume_data_storage_type', () => t('Resume data storage (needs a restart)'), [{ value: 'Legacy', get label() { return t('Fastresume files') } }, { value: 'SQLite', get label() { return t('SQLite database (experimental)') } }]),
          select('torrent_content_remove_option', () => t('When deleting files'), [{ value: 'Delete', get label() { return t('Delete them permanently') } }, { value: 'MoveToTrash', get label() { return t('Move them to the trash if possible') } }]),
          int('memory_working_set_limit', () => t('Memory use limit'), { unit: 'MiB' }),
          custom('current_network_interface', () => t('Network interface'), 'networkInterface'),
          custom('current_interface_address', () => t('IP address to bind to'), 'interfaceAddress'),
          int('save_resume_data_interval', () => t('Save resume data every'), { unit: 'minutes' }),
          int('save_statistics_interval', () => t('Save statistics every'), { unit: 'minutes' }),
          int('torrent_file_size_limit', () => t('Largest .torrent file to accept'), { unit: 'MiB', scale: 1024 * 1024 }),
          bool('confirm_torrent_recheck', () => t('Confirm torrent rechecks (qBittorrent\'s own interface)')),
          bool('confirm_remove_all_tags', () => t('Confirm removing all tags (qBittorrent\'s own interface)')),
          bool('confirm_remove_tracker_from_all_torrents', () => t('Confirm removing a tracker from all torrents (qBittorrent\'s own interface)')),
          bool('recheck_completed_torrents', () => t('Recheck torrents when they complete')),
          text('app_instance_name', () => t('Instance name')),
          int('refresh_interval', () => t('Refresh interval'), { unit: 'ms' }),
          bool('resolve_peer_host_names', () => t('Resolve peer host names')),
          bool('resolve_peer_countries', () => t('Resolve peer countries')),
          bool('reannounce_when_address_changed', () => t('Reannounce to all trackers when the IP or port changes')),
          bool('enable_embedded_tracker', () => t('Run the built-in tracker')),
          int('embedded_tracker_port', () => t('Built-in tracker port'), { dependsOn: 'enable_embedded_tracker' }),
          bool('embedded_tracker_port_forwarding', () => t('Forward the built-in tracker port'), { dependsOn: 'enable_embedded_tracker' }),
          bool('mark_of_the_web', () => t('Mark downloaded files as from the internet (Windows and macOS)')),
          bool('ignore_ssl_errors', () => t('Ignore SSL errors')),
          { key: 'python_executable_path', get label() { return t('Python program (for search)') }, type: 'file', help: 'Blank finds it automatically.' },
        ],
      },
      {
        title: 'libtorrent',
        get warning() { return t('Change these only if you know what they do.') },
        prefs: [
          int('bdecode_depth_limit', () => t('Bdecode depth limit')),
          int('bdecode_token_limit', () => t('Bdecode token limit')),
          int('async_io_threads', () => t('Asynchronous I/O threads')),
          int('hashing_threads', () => t('Hashing threads')),
          int('file_pool_size', () => t('File pool size')),
          int('checking_memory_use', () => t('Memory for checking torrents'), { unit: 'MiB' }),
          int('disk_cache', () => t('Disk cache'), { unit: 'MiB', help: '-1 picks automatically.' }),
          int('disk_cache_ttl', () => t('Disk cache expiry'), { unit: 'seconds' }),
          int('disk_queue_size', () => t('Disk queue size'), { unit: 'KiB', scale: 1024 }),
          select('disk_io_type', () => t('Disk I/O type (needs a restart)'), [{ value: 0, get label() { return t('Default') } }, { value: 1, get label() { return t('Memory mapped files') } }, { value: 2, label: 'POSIX-compliant' }, { value: 3, get label() { return t('Simple pread/pwrite') } }]),
          select('disk_io_read_mode', () => t('Disk read mode'), [{ value: 0, get label() { return t('Disable OS cache') } }, { value: 1, get label() { return t('Enable OS cache') } }]),
          select('disk_io_write_mode', () => t('Disk write mode'), [{ value: 0, get label() { return t('Disable OS cache') } }, { value: 1, get label() { return t('Enable OS cache') } }, { value: 2, get label() { return t('Write-through') } }]),
          bool('enable_coalesce_read_write', () => t('Coalesce reads and writes')),
          bool('enable_piece_extent_affinity', () => t('Use piece extent affinity')),
          bool('enable_upload_suggestions', () => t('Send upload piece suggestions')),
          int('send_buffer_watermark', () => t('Send buffer watermark'), { unit: 'KiB' }),
          int('send_buffer_low_watermark', () => t('Send buffer low watermark'), { unit: 'KiB' }),
          int('send_buffer_watermark_factor', () => t('Send buffer watermark factor'), { unit: '%' }),
          int('connection_speed', () => t('Outgoing connections per second')),
          int('socket_send_buffer_size', () => t('Socket send buffer size (0 = system default)'), { unit: 'KiB', scale: 1024 }),
          int('socket_receive_buffer_size', () => t('Socket receive buffer size (0 = system default)'), { unit: 'KiB', scale: 1024 }),
          int('socket_backlog_size', () => t('Socket backlog size')),
          int('outgoing_ports_min', () => t('Outgoing ports, from (0 = any)')),
          int('outgoing_ports_max', () => t('Outgoing ports, to (0 = any)')),
          int('upnp_lease_duration', () => t('UPnP lease duration (0 = permanent)'), { unit: 'seconds' }),
          int('peer_tos', () => t('Type of service (ToS) for peer connections')),
          select('utp_tcp_mixed_mode', () => t('μTP-TCP mixed mode'), [{ value: 0, get label() { return t('Prefer TCP') } }, { value: 1, get label() { return t('Peer proportional (throttles TCP)') } }]),
          int('hostname_cache_ttl', () => t('Host name cache lifetime'), { unit: 'seconds' }),
          bool('idn_support_enabled', () => t('Support internationalized domain names')),
          bool('enable_multi_connections_from_same_ip', () => t('Allow several connections from the same IP')),
          bool('enable_multi_connections_from_same_peer_id', () => t('Allow several connections from the same peer ID')),
          bool('seeding_outgoing_connections', () => t('Allow outgoing connections while seeding')),
          bool('validate_https_tracker_certificate', () => t('Check HTTPS tracker certificates')),
          bool('ssrf_mitigation', () => t('Server-side request forgery (SSRF) mitigation')),
          bool('block_peers_on_privileged_ports', () => t('Block peers on privileged ports')),
          select('upload_slots_behavior', () => t('Upload slots'), [{ value: 0, get label() { return t('Fixed slots') } }, { value: 1, get label() { return t('Upload rate based') } }]),
          select('upload_choking_algorithm', () => t('Upload choking'), [{ value: 0, get label() { return t('Round-robin') } }, { value: 1, get label() { return t('Fastest upload') } }, { value: 2, get label() { return t('Anti-leech') } }]),
          bool('announce_to_all_trackers', () => t('Announce to all trackers in a tier')),
          bool('announce_to_all_tiers', () => t('Announce to all tiers')),
          text('announce_ip', () => t('IP address reported to trackers (blank = automatic)')),
          int('announce_port', () => t('Port reported to trackers (0 = listening port)')),
          int('max_concurrent_http_announces', () => t('Maximum simultaneous HTTP announces')),
          int('stop_tracker_timeout', () => t('Stop tracker timeout'), { unit: 'seconds' }),
          int('peer_turnover', () => t('Peer turnover disconnect'), { unit: '%' }),
          int('peer_turnover_cutoff', () => t('Peer turnover threshold'), { unit: '%' }),
          int('peer_turnover_interval', () => t('Peer turnover interval'), { unit: 'seconds' }),
          int('request_queue_size', () => t('Maximum outstanding requests to a peer')),
          int('max_outstanding_block_requests', () => t('Maximum outstanding block requests from a peer')),
          text('webtorrent_stun_server', () => t('STUN server for WebTorrent')),
          text('dht_bootstrap_nodes', () => t('DHT bootstrap nodes'), { help: 'host:port, separated by commas. Blank uses the defaults.' }),
        ],
      },
      {
        get title() { return t('Cookies') },
        prefs: [custom('cookies', () => t('Cookies for downloads and RSS'), 'cookies')],
      },
      {
        get title() { return t('Shut down') },
        prefs: [custom('shutdown', () => t('Shut down qBittorrent'), 'shutdown')],
      },
    ],
  },
]
