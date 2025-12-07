
import { LoginCredentials, StreamItem, StreamCategory, XtreamLoginResponse, XtreamLiveStream, XtreamVodStream, XtreamSeriesStream, StreamType } from '../types';

// Helper to handle URL formatting
const formatUrl = (url: string) => url.replace(/\/$/, '');

export const authenticateUser = async (creds: LoginCredentials): Promise<XtreamLoginResponse> => {
    const baseUrl = formatUrl(creds.url);
    const url = `${baseUrl}/player_api.php?username=${creds.username}&password=${creds.password}`;
    
    // We strictly throw errors here to let the UI handle the failure reason (CORS, 404, etc.)
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.user_info || data.user_info.auth !== 1) {
        throw new Error('Authentication failed: Invalid credentials or status.');
    }

    return data;
};

export const fetchXtreamData = async (creds: LoginCredentials, action: 'get_live_categories' | 'get_vod_categories' | 'get_series_categories' | 'get_live_streams' | 'get_vod_streams' | 'get_series') => {
    const baseUrl = formatUrl(creds.url);
    const url = `${baseUrl}/player_api.php?username=${creds.username}&password=${creds.password}&action=${action}`;
    
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${action} (Status: ${response.status})`);
    }
    return await response.json();
};

// --- URL Builders ---

export const getLiveStreamUrl = (creds: LoginCredentials, streamId: number | string) => {
    const baseUrl = formatUrl(creds.url);
    // Use HLS format (/live/.../id.m3u8) for better web browser compatibility
    // Raw MPEG-TS (default without /live/ and .m3u8) often fails in web players
    return `${baseUrl}/live/${creds.username}/${creds.password}/${streamId}.m3u8`;
};

export const getVodStreamUrl = (creds: LoginCredentials, streamId: number | string, extension: string = 'mp4') => {
    const baseUrl = formatUrl(creds.url);
    // VOD standard path
    return `${baseUrl}/movie/${creds.username}/${creds.password}/${streamId}.${extension}`;
};

// --- Mappers ---

export const mapLiveStreamToItem = (item: XtreamLiveStream, creds: LoginCredentials): StreamItem => {
    return {
        num: Number(item.num),
        name: item.name,
        stream_type: StreamType.LIVE,
        stream_id: Number(item.stream_id),
        stream_icon: item.stream_icon,
        epg_channel_id: item.epg_channel_id,
        category_id: item.category_id,
        direct_source: getLiveStreamUrl(creds, item.stream_id)
    };
};

export const mapVodStreamToItem = (item: XtreamVodStream, creds: LoginCredentials): StreamItem => {
    const extension = item.container_extension || 'mp4';
    return {
        num: Number(item.num),
        name: item.name,
        stream_type: StreamType.MOVIE,
        stream_id: Number(item.stream_id),
        stream_icon: item.stream_icon,
        category_id: item.category_id,
        rating: item.rating,
        container_extension: extension,
        direct_source: getVodStreamUrl(creds, item.stream_id, extension)
    };
};

export const mapSeriesStreamToItem = (item: XtreamSeriesStream): StreamItem => {
    return {
        num: Number(item.num),
        name: item.name,
        stream_type: StreamType.SERIES,
        stream_id: Number(item.series_id),
        stream_icon: item.cover,
        category_id: item.category_id,
        rating: item.rating,
        // Series playback is more complex (requires fetching episodes), leaving blank for now
        direct_source: '' 
    };
};
