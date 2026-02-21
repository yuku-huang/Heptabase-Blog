/**
 * Vercel Serverless API：代理 Heptabase 公開 API，解決部署後 CORS 無法即時取資料的問題。
 * 前端在 production 改打 /api/heptabase（同源），由此 function 代為請求 api.heptabase.com。
 */

const DEFAULT_WHITEBOARD_UUID = '946f23a3-75ef-48e3-8e7b-35c2376f2559';

const BASE_HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'heptabase-db-schema-version': '126'
};

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json; charset=utf-8'
    };
}

async function fetchFromHeptabase(whiteboardId) {
    const uuid = whiteboardId || process.env.WHITEBOARD_UUID || DEFAULT_WHITEBOARD_UUID;
    if (!uuid) {
        throw new Error('whiteboard_uuid is not set');
    }

    // Step 1: 取得 whiteboard 結構（所有 cardInstance IDs）
    const structureRes = await fetch(
        'https://api.heptabase.com/v1/collaboration/getAllDataForWhiteboard',
        {
            method: 'POST',
            headers: BASE_HEADERS,
            body: JSON.stringify({
                whiteboardId: uuid,
                doFetchDataForWhiteboardQuickRender: true,
                permissionCheckMode: 'public'
            })
        }
    );
    if (!structureRes.ok) {
        throw new Error(`getAllDataForWhiteboard failed: ${structureRes.status}`);
    }
    const structureData = await structureRes.json();
    const cardInstances = structureData?.accessibleObjectMap?.cardInstance || {};

    const cardIds = [...new Set(
        Object.values(cardInstances)
            .map(inst => inst.cardId)
            .filter(Boolean)
    )];
    if (cardIds.length === 0) {
        return { code: 200, data: { cards: [] } };
    }

    // Step 2: 批量取得所有 card 完整內容
    const cardsRes = await fetch(
        'https://api.heptabase.com/v1/getObjectsMapV2',
        {
            method: 'POST',
            headers: BASE_HEADERS,
            body: JSON.stringify({
                objects: cardIds.map(id => ({ objectType: 'card', objectId: id })),
                permissionCheckMode: 'public'
            })
        }
    );
    if (!cardsRes.ok) {
        throw new Error(`getObjectsMapV2 failed: ${cardsRes.status}`);
    }
    const cardsData = await cardsRes.json();
    const cardsMap = cardsData?.objectsMap?.card || {};

    const cards = Object.values(cardsMap).map(card => ({
        id: card.id,
        title: card.title || '',
        content: card.content || '{}',
        createdTime: card.createdTime,
        lastEditedTime: card.lastEditedTime,
        createdBy: card.createdBy,
    }));

    return { code: 200, data: { cards } };
}

module.exports = async function handler(req, res) {
    const origin = req.headers.origin || '*';

    if (req.method === 'OPTIONS') {
        res.status(200).setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.end();
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
        res.status(405).setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', origin);
        return res.json({ code: 405, error: 'Method not allowed' });
    }

    let whiteboardId = process.env.WHITEBOARD_UUID || DEFAULT_WHITEBOARD_UUID;
    if (req.method === 'GET' && req.query?.whiteboard_uuid) {
        whiteboardId = req.query.whiteboard_uuid;
    }
    if (req.method === 'POST' && req.body?.whiteboard_uuid) {
        whiteboardId = req.body.whiteboard_uuid;
    }

    try {
        const data = await fetchFromHeptabase(whiteboardId);
        Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.setHeader(k, v));
        return res.status(200).json(data);
    } catch (err) {
        console.error('api/heptabase error:', err.message);
        Object.entries(corsHeaders(origin)).forEach(([k, v]) => res.setHeader(k, v));
        return res.status(500).json({
            code: 500,
            error: err.message || 'Heptabase proxy error'
        });
    }
}
