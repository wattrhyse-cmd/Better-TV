
export enum StreamType {
  LIVE = 'live',
  MOVIE = 'movie',
  SERIES = 'series',
}

export interface StreamCategory {
  category_id: string;
  category_name: string;
  parent_id: number;
}

export interface SubtitleTrack {
  id: string;
  label: string;
  language: string;
  src: string;
}

export interface StreamItem {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon?: string;
  epg_channel_id?: string;
  added?: string;
  category_id: string;
  rating?: string;
  rating_5based?: number;
  direct_source?: string;
  container_extension?: string;
  progress?: number;
  subtitles?: SubtitleTrack[];
}

export interface EPGProgram {
  title: string;
  start: Date;
  end: Date;
  description: string;
}

export interface XtreamLoginResponse {
  user_info: {
    username: string;
    password: string;
    message: string;
    auth: number;
    status: string;
    exp_date: string;
    is_trial: string;
    active_cons: string;
    created_at: string;
    max_connections: string;
  };
  server_info: {
    url: string;
    port: string;
    https_port: string;
    server_protocol: string;
    rtmp_port: string;
    timezone: string;
    timestamp_now: number;
    time_now: string;
  };
}

// Raw API Interfaces
export interface XtreamLiveStream {
  num: number | string;
  name: string;
  stream_type: string;
  stream_id: number | string;
  stream_icon?: string;
  epg_channel_id?: string;
  added?: string;
  category_id: string;
  tv_archive?: number;
  direct_source?: string;
}

export interface XtreamVodStream {
  num: number | string;
  name: string;
  stream_type: string;
  stream_id: number | string;
  stream_icon?: string;
  added?: string;
  category_id: string;
  container_extension?: string;
  rating?: string;
  direct_source?: string;
}

export interface XtreamSeriesStream {
    num: number | string;
    name: string;
    series_id: number | string;
    cover?: string;
    plot?: string;
    category_id: string;
    rating?: string;
}

export interface LoginCredentials {
  name?: string;
  url: string;
  username: string;
  password: string;
}

export interface AppTheme {
  id: string;
  name: string;
  colors: {
    background: string;
    sidebar: string;
    cardBg: string;
    textAccent: string;
    bgAccent: string;
    bgAccentHover: string;
    borderAccent: string;
    gradient: string;
    iconBg: string;
  };
}

export type AppView = 'LOGIN' | 'DASHBOARD' | 'LIVE' | 'MOVIES' | 'SERIES' | 'FAVORITES' | 'AI_SEARCH' | 'SETTINGS' | 'UPDATES';
