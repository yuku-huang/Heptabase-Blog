import CONFIG from "./config";
import { Modal } from 'antd';

const { confirm } = Modal;

const getWhiteboardId = () => CONFIG.whiteboard_id || '';

// cards 參數由呼叫方傳入（移除全域 heptabaseData 依賴）
const getCardName = (cardId, cards = []) => {
    for (let i = 0; i < cards.length; i++) {
        if (cards[i]['id'] === cardId) {
            return cards[i]
        }
    }
    return null
}

// fetch 错误时的反馈弹窗
const showConfirm = () => {
    confirm({
        title: 'Sorry,some ting erro😥',
        // icon: <ExclamationCircleFilled />,
        content: 'Please try refresh',
        okText: 'Refresh',
        onOk() {
            console.log('Refresh');
            window.location.replace(window.location.href)
        },
        onCancel() {
            console.log('Cancel');
        },
    });
};

// 计算指定时间与当前的时间差
const getLastEditedTime = (dateBegin) => {

    dateBegin = new Date(dateBegin)

    let dateEnd = new Date();

    // 时间差的毫秒数
    let dateDiff = dateEnd.getTime() - dateBegin.getTime()
    // 时间差的天数
    let dayDiff = Math.floor(dateDiff / (24 * 3600 * 1000))

    // 计算除天数外剩余的毫秒数
    let leave1 = dateDiff % (24 * 3600 * 1000)
    // 小时数
    let hours = Math.floor(leave1 / (3600 * 1000))

    // 计算除小时剩余的分钟数
    let leave2 = leave1 % (3600 * 1000)
    // 分钟数
    let minutes = Math.floor(leave2 / (60 * 1000))

    //计算相差的秒数
    let leave3 = leave2 % (60 * 1000)
    let seconds = Math.round(leave3 / 1000)

    return { 'day': dayDiff, 'hours': hours, 'minutes': minutes, 'seconds': seconds }

}

// 处理网易云音乐
// 输入 markdown 格式的 URL，例如 [xxx](http:....)，返回网易云音乐的 iframe HTML
const setNeteaseMusic = (custom_old_card) => {
    // 判断类型是歌曲还是歌单
    let type = 2 //歌曲
    let height_1 = 52
    let height_2 = 32
    if (custom_old_card.indexOf('playlist') > -1 || custom_old_card.indexOf('album') > -1) {

        height_1 = 110
        height_2 = 90

        if (custom_old_card.indexOf('playlist') > -1) {
            type = 0 // 歌单
        }
        if (custom_old_card.indexOf('album') > -1) {
            type = 1 // 专辑
        }
    }

    // 获取歌曲 ID
    let music_id_reg = /[0-9]{4,14}/g
    let music_id_list = custom_old_card.match(music_id_reg)

    if (music_id_list) {
        // 匹配到 ID
        let music_id = music_id_list[0]
        let netease_music_iframe = '<div class="music netease_music"><iframe frameborder="no" border="0" marginwidth="0" marginheight="0" height=' + height_1 + ' style="width: 100%; " src="//music.163.com/outchain/player?type=' + type + '&id=' + music_id + '&auto=0&height=' + height_2 + '"></iframe></div>'

        return netease_music_iframe

    } else {
        return undefined
    }

}

// 修复单个 md 文件中的 img
const getClearImag = (card) => {

    // 修改图片后缀，避免图片无法显示
    // 找到 ![]( 符号
    // 找到上述符号之后的第 1 个 jpg#/png#/gif# 符号
    // 找到上一个步骤后的第 1 个 ) 符号
    // 删除前面 2 步 index 中间的符号

    let content = card['content']

    // 支持的图片类型
    let img_type = ['.png', '.jpeg', '.jpg', '.gif']
    // 包含以下关键字则认为是图片
    let img_keyword_index = content.indexOf('![')

    while (img_keyword_index !== -1) {


        // 获取下一个 ) 索引
        let img_end_inex = content.indexOf(')', img_keyword_index)

        // 获取下一个 ] 索引
        let img_alt_end_inex = content.indexOf(']', img_keyword_index)

        // 获取图片扩展名索引
        let img_etc_index
        for (let i = 0; i < img_type.length; i++) {
            img_etc_index = content.indexOf(img_type[i], img_keyword_index + 1)
            if (img_etc_index >= 0 && img_etc_index <= img_end_inex) {

                // 如果格式字符是这种格式 ![....jpg] 内，则跳过
                if (content.substring(img_etc_index + img_type[i].length, img_etc_index + img_type[i].length + 2) === '](') {
                    img_etc_index = content.indexOf(img_type[i], img_etc_index + 1)

                }

                img_etc_index += img_type[i].length
                break;


            }
        }

        if (img_keyword_index === -1 || img_end_inex === -1 || img_etc_index === -1) {
            break
        }

        let img_alt = content.substring(img_keyword_index + 2, img_alt_end_inex)
        let img_src = content.substring(img_alt_end_inex + 2, img_etc_index)

        // console.log('image keyword');
        // console.log(img_alt);
        // console.log(img_src);

        let old_img_str = content.substring(img_keyword_index, img_end_inex + 1)


        // 获取 = 索引
        let img_width_inex = old_img_str.indexOf('=')

        if (img_width_inex > -1 && old_img_str.indexOf('{{width') < 0) {
            //将图片宽度保存到 alt 中
            img_alt = img_alt + '{{width ' + old_img_str.substring(img_width_inex + 1, old_img_str.length - 2) + '}}'
        }

        let new_img_str = '![' + img_alt + '](' + img_src + ')'

        content = content.replace(old_img_str, new_img_str)

        // 获取 ![ 索引
        img_keyword_index = content.indexOf('![', img_keyword_index + 1)


    }
    card['content'] = content
    return card

}

// 处理单个 md 文件中的超链接
const getClearCard = (card, cards) => {

    // // 找到 (./ 符号以及之后的第 1 个 ，或找到 {{ 符号 }}) 符号，截取这 2 个 index 中间的字符串
    // // 将上述字符串放在 card 数据中匹配
    // // 如果找到匹配的卡片：修改上述字符串的地址为 /post/post.id
    // let content = card['content']
    let this_card_id = card['id']

    // 处理反向连接
    // 如果 A 卡片中存在当前笔记的 ID，则 A 卡片为当前笔记的反向链接之一
    let backLinks = []
    for (let i = 0; i < cards.length; i++) {
        let content = cards[i]['content']
        if (typeof (content) !== 'string') {
            content = cards[i]['content'].innerHTML
        }

        if (content.indexOf(this_card_id) >= 0 && cards[i]['id'] !== this_card_id) {

            backLinks.push(cards[i])

        }


    }

    // card['content'] = content
    return { 'card': card, 'backLinks': backLinks }

}

// 从服务端获取 Heptabase 的笔记数据
const getHeptabaseDataFromServer = async () => {
    let myHeaders = new Headers();
    myHeaders.append("User-Agent", "Apifox/1.0.0 (https://apifox.com)");

    let requestOptions = {
        method: 'GET',
        headers: myHeaders,
        redirect: 'follow'
    };

    try {
        const whiteboard_id = getWhiteboardId();
        const result = await fetch("https://api.blog.kii.la/?shared-id=" + whiteboard_id, requestOptions);
        const getDataResponse = await result.json();

        if ((getDataResponse.code === 0 || getDataResponse.code === 200) && Array.isArray(getDataResponse?.data?.cards)) {
            // 成功获取数据

            const data = getDataResponse
            // 处理卡片数据
            const newData = handleHeptabaseData(data)
            return newData


        } else {
            // 未成功获取，需要添加此白板到服务端中

            let myHeaders = new Headers();
            myHeaders.append("User-Agent", "Apifox/1.0.0 (https://apifox.com)");
            myHeaders.append("Content-Type", "application/json");

            let raw = JSON.stringify({
                "shared_id": whiteboard_id,
                "allow_origin": []
            });

            let requestOptions = {
                method: 'POST',
                headers: myHeaders,
                body: raw,
                redirect: 'follow'
            };

            const result = await fetch("https://api.blog.kii.la/add", requestOptions)
            const addWhiteboardResponse = await result.json();

            if (addWhiteboardResponse.code === 0) {

                setTimeout(() => {
                    // 添加白板后再次获取一次数据
                    getHeptabaseDataFromServer()
                }, 5000);

            }

        }


    } catch (error) {

        console.log('error', error);

    }
};

/**
 * 直接呼叫 Heptabase 公開 API，取得即時資料
 * 不再依賴靜態 data.json
 * 部署到 Vercel 時改為呼叫同源 /api/heptabase 代理，避免 CORS 阻擋。
 */
const fetchFromHeptabasePublicAPI = async () => {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
        const base = typeof window !== 'undefined' ? window.location.origin : '';
        const res = await fetch(`${base}/api/heptabase`);
        if (!res.ok) {
            throw new Error(`/api/heptabase failed: ${res.status}`);
        }
        return res.json();
    }

    const uuid = CONFIG.whiteboard_uuid;
    if (!uuid) {
        throw new Error('CONFIG.whiteboard_uuid is not set');
    }

    const BASE_HEADERS = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'heptabase-db-schema-version': CONFIG.heptabase_db_schema_version || '127'
    };

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

    // 提取所有唯一的 card ID
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

    // Step 3: Adapter — 轉換成現有 data.cards[] 格式
    // 現有格式：{ id, title, content (JSON string), createdTime, lastEditedTime, createdBy }
    const cards = Object.values(cardsMap).map(card => ({
        id: card.id,
        title: card.title || '',
        content: card.content || '{}',
        createdTime: card.createdTime,
        lastEditedTime: card.lastEditedTime,
        createdBy: card.createdBy,
    }));

    return { code: 200, data: { cards } };
};

// 获取 Heptabase 的笔记数据
const getHeptabaseData = async () => {
    console.log('getHeptabaseData — 直接呼叫 Heptabase API');
    try {
        const data = await fetchFromHeptabasePublicAPI();
        return handleHeptabaseData(data);
    } catch (err) {
        console.error('fetchFromHeptabasePublicAPI failed, falling back to legacy API:', err);
        return await getHeptabaseDataFromServer();
    }

    // 获取本地数据
    let heptabaseDataFromLocal = JSON.parse(localStorage.getItem("heptabase_blog_data"))


    if (heptabaseDataFromLocal) {

        // 存在本地数据
        if (heptabaseDataFromLocal.data?.Etag && heptabaseDataFromLocal.whiteboard_id) {

            // 判断本地数据是否需要更新
            let myHeaders = new Headers();
            myHeaders.append("User-Agent", "Apifox/1.0.0 (https://apifox.com)");

            let requestOptions = {
                method: 'GET',
                headers: myHeaders,
                redirect: 'follow'
            };

            const whiteboard_id = getWhiteboardId();
            const result = await fetch("https://api.blog.kii.la/etag?shared-id=" + whiteboard_id, requestOptions)
            const etagFromServer = await result.json();

            console.log('etagFromServer:');
            console.log(etagFromServer);

            // Etag 不同或者本地缓存的白板 ID 与配置中的不同
            if (etagFromServer.data !== heptabaseDataFromLocal.data.Etag || heptabaseDataFromLocal.whiteboard_id !== whiteboard_id) {
                //需要更新
                const data = await getHeptabaseDataFromServer();
                return data;
            } else {
                //不需要更新
                return heptabaseDataFromLocal;
            }
        } else {
            // 需要到服务端获取
            const data = await getHeptabaseDataFromServer();
            return data;
        }

    } else {
        // 本地不存在数据，则需要到服务端获取
        const heptabaseDataFromServer = await getHeptabaseDataFromServer();
        return heptabaseDataFromServer;
    }
};


const handleHeptabaseData = (data) => {

    data.data.cards = data.data.cards.sort((a, b) => {

        // 最近编辑时间
        return b.lastEditedTime < a.lastEditedTime ? -1 : 1

    })

    let pages = {}
    // 获取 About、Projects 页面的数据
    pages.about = undefined
    pages.firstPage = undefined
    // pages.projects = undefined

    // 存储去重后的数组
    let new_cards = []
    // 存储卡片 ID，用户判断是否重复
    let cards_id = []

    const configPages = CONFIG.pages
    const firstPageKey = Object.keys(configPages)[0]
    const firstPageId = configPages[firstPageKey];


    for (let i = 0; i < data.data.cards.length; i++) {

        // 首页
        if (data.data.cards[i]['title'].toLowerCase() === 'about') {

            pages.about = data.data.cards[i]

        }

        // 查找 CONFIG 的 pages 中第 1 个卡片的数据
        if (data.data.cards[i].id === firstPageId) {
            pages.firstPage = data.data.cards[i]
        }


        // Projects
        // if (data.data.cards[i]['title'].toLowerCase() === 'projects') {

        //     pages.projects = data.data.cards[i]

        // }

        // 去重
        if (cards_id.indexOf(data.data.cards[i]['id']) > -1) {
            // 已存在此卡片，则忽略
            // console.log(data.cards[i]);
        } else {

            // 不存在此卡片

            // 最近编辑的时间差
            let timeDiff = getLastEditedTime(data.data.cards[i]['lastEditedTime'])
            data.data.cards[i].lastEditedTimeDiff = ''
            if (timeDiff['day'] > 0) {
                data.data.cards[i].lastEditedTimeDiff = 'Edited ' + timeDiff['day'] + ' days ago'
            } else if (timeDiff['hours'] > 0) {

                data.data.cards[i].lastEditedTimeDiff = 'Edited ' + timeDiff['hours'] + ' hours ago'

            } else if (timeDiff['minutes'] > 0) {

                data.data.cards[i].lastEditedTimeDiff = 'Edited ' + timeDiff['minutes'] + ' minutes ago'

            } else {

                data.data.cards[i].lastEditedTimeDiff = 'Edited just'

            }

            new_cards.push(data.data.cards[i])
            cards_id.push(data.data.cards[i]['id'])

        }

    }

    data.data.cards = new_cards
    data.frontGetTime = Date.parse(new Date()) / 1000
    data.pages = pages
    data.whiteboard_id = getWhiteboardId()

    // 存储数据到本地缓存

    try {
        localStorage.setItem("heptabase_blog_data", JSON.stringify(data))
    } catch (error) {
        console.log(error);
    }

    return data; // 返回结果

}



/**
 * @param {Object} Hpeta_card_data Hepta 卡片数据
 * @returns 返回拼接后的 DOM 元素
 */
const heptaToMD = (Hpeta_card_data, allCards = []) => {

    // 如果对象已经是 DOM 则直接返回
    if (Hpeta_card_data['content'] instanceof HTMLElement) {
        return Hpeta_card_data['content']
    }

    let parent_card_id = Hpeta_card_data['id']
    let box = document.createElement('div')
    box = heptaContentTomd(JSON.parse(Hpeta_card_data['content'])['content'], box, parent_card_id, allCards)
    return box


}

/**
 * 
 * @param {list} content_list   block 列表
 * @param {string} parent_node   要添加子元素的父级 DOM 元素
 * @param {string} parent_card_id  当前卡片的 ID
 * @returns 返回拼接后的 md 字符串                    
 */
const heptaContentTomd = (content_list, parent_node, parent_card_id, allCards = []) => {

    let new_node
    let number_list_index = 1

    //遍历 content list
    for (let i = 0; i < content_list.length; i++) {

        // 根据 type 进行处理
        switch (content_list[i]['type']) {

            case 'heading':

                new_node = document.createElement('H' + content_list[i]['attrs']['level'])

                break

            case 'card':
                new_node = document.createElement('span')
                if (content_list[i]['attrs']['cardTitle'] !== undefined && content_list[i]['attrs']['cardTitle'] !== null) {
                    // cardTitle 有值才設定，避免 undefined 被轉成字串 "undefined"
                    new_node.innerHTML = content_list[i]['attrs']['cardTitle']
                } else {
                    // cardTitle 為 undefined/null，嘗試用 cardId 在白板資料中找標題
                    const card = getCardName(content_list[i]['attrs']['cardId'], allCards)
                    if (card) {
                        new_node.innerHTML = card.title
                    }
                    // 若仍找不到，innerHTML 維持空字串（不顯示 "undefined"）
                }

                let bingo = false

                if (content_list[i]['attrs']['cardTitle'] === 'Invalid card') {
                    // 未知卡片（不在白板上），先在全域資料中搜尋標題
                    for (let k = 0; k < allCards.length; k++) {
                        if (allCards[k]['id'] === content_list[i]['attrs']['cardId']) {
                            new_node.innerHTML = allCards[k]['title']
                            bingo = true
                            break
                        }
                    }
                }

                if (bingo === true || content_list[i]['attrs']['cardTitle'] !== 'Invalid card') {
                    new_node.classList.add('my_link')
                    new_node.classList.add('article_link')
                    new_node.setAttribute('path', '/post/' + content_list[i]['attrs']['cardId'])
                    new_node.setAttribute('parent_note_id', parent_card_id)
                } else {
                    // 真正找不到的卡片：顯示純文字（無超連結），清除 'Invalid card' 字樣
                    new_node.innerHTML = ''
                    new_node.classList.add('unknown_card_plain')
                }







                break

            case 'whiteboard':
                new_node = document.createTextNode(content_list[i]['attrs']['whiteboardName'])
                break

            case 'image':

                new_node = document.createElement('div')
                let imgBox = document.createElement('img')
                imgBox.setAttribute('src', content_list[i]['attrs']['src'])
                new_node.classList.add('imgBox')
                new_node.appendChild(imgBox)

                if (content_list[i]['attrs']['width'] !== null) {
                    imgBox.setAttribute('style', 'width: ' + content_list[i]['attrs']['width']);
                }


                break

            case 'paragraph':
                // 如果父元素不是 task-list-item ，则创建 P 元素
                if (parent_node) {

                    if (parent_node['className'] !== 'task-list-item') {
                        new_node = document.createElement('p')
                        // 空段落（無 content）：自動加 <br> 讓空白行有高度，不需再手動塞全形空白
                        if (!('content' in content_list[i]) || content_list[i]['content'].length === 0) {
                            new_node.appendChild(document.createElement('br'))
                        }
                    } else {
                        new_node = document.createElement('span')
                        new_node.setAttribute('style', 'margin-left:4px');
                    }

                }

                break

            case 'text':
                // 普通文本
                if (content_list[i]['text'].indexOf('{HTML}') > -1) {
                    break
                }


                // 判断是否有行内样式，例如 strong、mark

                if ('marks' in content_list[i]) {

                    // 有行内样式
                    content_list[i]['marks'].forEach(mark => {

                        switch (mark['type']) {

                            // del-line
                            case 'strike':
                                new_node = document.createElement('del')
                                new_node.innerText = content_list[i]['text']
                                break

                            // inline-code
                            case 'code':
                                new_node = document.createElement('code')
                                new_node.innerText = content_list[i]['text']
                                break

                            // italic
                            case 'em':
                                new_node = document.createElement('em')
                                new_node.innerText = content_list[i]['text']
                                break

                            // strong
                            case 'strong':
                                new_node = document.createElement('strong')
                                new_node.innerText = content_list[i]['text']
                                break

                            // underline
                            case 'underline':
                                new_node = document.createElement('u')
                                new_node.innerText = content_list[i]['text']
                                break

                            case 'color':

                                new_node = document.createElement('span')

                                if (mark['attrs']['color']) {

                                    if (mark['attrs']['type'] === 'background') {
                                        // new_node.setAttribute('style', 'background-color: ' + mark['attrs']['color']);

                                        new_node.classList.add('highlight_bg')
                                    } else {
                                        // new_node.setAttribute('style', 'color: ' + mark['attrs']['color']);
                                        new_node.classList.add('highlight_color')
                                    }

                                }

                                new_node.innerText = content_list[i]['text']
                                break

                            case 'link':
                                // let link_title = mark['attrs']['title']
                                // if (link_title === null) {
                                //     link_title = mark['attrs']['href']
                                // }

                                if (mark['attrs']['data-internal-href'] !== null) {
                                    // 内部卡片链接
                                    new_node = document.createElement('span')
                                    new_node.innerHTML = content_list[i]['text']
                                    new_node.classList.add('my_link')
                                    new_node.classList.add('article_link')
                                    new_node.setAttribute('path', '/post/' + mark['attrs']['data-internal-href'].replace('meta://card/', ''))
                                    new_node.setAttribute('parent_note_id', parent_card_id)

                                } else {

                                    if (mark['attrs']['href'].indexOf('app.heptabase') > -1 && mark['attrs']['href'].indexOf('card/') > -1) {
                                        // Link to block
                                        // 获取 card ID
                                        let card_id_index_start = mark['attrs']['href'].indexOf('card/')
                                        let card_id_index_end = mark['attrs']['href'].indexOf('#')

                                        if (card_id_index_start > -1) {
                                            let card_id = mark['attrs']['href'].substring(card_id_index_start + 5, card_id_index_end > -1 ? card_id_index_end : mark['attrs']['href'].length)

                                            new_node = document.createElement('span')
                                            new_node.innerHTML = content_list[i]['text']
                                            new_node.classList.add('my_link')
                                            new_node.classList.add('article_link')
                                            new_node.setAttribute('path', '/post/' + card_id)
                                            new_node.setAttribute('parent_note_id', parent_card_id)

                                        } else {
                                            // 外链
                                            new_node = document.createElement('a')
                                            new_node.classList.add('external_link')
                                            new_node.href = mark['attrs']['href']
                                            new_node.setAttribute('target', '_blank')
                                            new_node.setAttribute('rel', 'noopener noreferrer')
                                            new_node.innerHTML = content_list[i]['text']
                                        }

                                    } else {
                                        // 外链
                                        new_node = document.createElement('a')
                                        new_node.classList.add('external_link')
                                        new_node.href = mark['attrs']['href']
                                        new_node.setAttribute('target', '_blank')
                                        new_node.setAttribute('rel', 'noopener noreferrer')
                                        new_node.innerHTML = content_list[i]['text']
                                    }




                                }

                                break
                            default:
                                break

                        }

                    });
                } else {
                    // 无行内样式
                    // new_node = document.createElement('span')
                    // new_node.innerText = new_node.innerText + content_list[i]['text']

                    new_node = document.createTextNode(content_list[i]['text'])

                }

                break

            case 'bullet_list_item':
                // List 容器
                const bulletListBox = document.createElement('div')
                bulletListBox.classList.add('listBox')

                // List 手柄
                const bulletHand = document.createElement('div')
                bulletHand.classList.add('listBullet')

                // List 内容
                new_node = document.createElement('div')
                new_node.setAttribute('style', 'overflow: auto');

                bulletListBox.appendChild(bulletHand)
                bulletListBox.appendChild(new_node)

                parent_node.appendChild(bulletListBox)

                break

            case 'numbered_list_item':

                // 如果上一个节点不是 number_list 则此节点的 index 为 1，否则 index +=1
                if (i > 0) {
                    if (content_list[i - 1]['type'] !== 'numbered_list_item') {
                        number_list_index = 1
                    } else {
                        number_list_index += 1
                    }
                }

                // List 容器
                const numberListBox = document.createElement('div')
                numberListBox.classList.add('listBox')

                // List 手柄
                const numberHand = document.createElement('div')
                // numberHand.classList.add('listBullet')
                numberHand.classList.add('numberListBullet')
                numberHand.setAttribute('data-before', number_list_index + '.')
                // numberHand.attr('--before-content', beforeContent)

                // List 内容
                new_node = document.createElement('div')
                new_node.setAttribute('style', 'overflow: auto');

                numberListBox.appendChild(numberHand)
                numberListBox.appendChild(new_node)

                parent_node.appendChild(numberListBox)

                break

            case 'todo_list_item':
                new_node = document.createElement('li')

                let task_input = document.createElement('input')
                task_input.type = 'checkbox'
                // task_input.checked = 'true'
                if (content_list[i]['attrs']['checked']) {
                    task_input.setAttribute("checked", content_list[i]['attrs']['checked']);
                }

                task_input.disabled = true

                new_node.classList.add('task-list-item')
                // new_node.setAttribute('style', 'margin: 16px 0');
                new_node.appendChild(task_input)
                break

            case 'ordered_list':
                new_node = document.createElement('ol')
                break

            case 'bullet_list':
                new_node = document.createElement('ul')
                break

            case 'toggle_list':
                new_node = document.createElement('div')
                break

            case 'toggle_list_item':
                new_node = document.createElement('div')
                break

            case 'task_list':
                new_node = document.createElement('ul')
                new_node.classList.add('task-list')
                break

            case 'list_item':
                new_node = document.createElement('li')

                // 如果是 task
                if (parent_node.className.indexOf('task-list') > -1) {
                    let task_input = document.createElement('input')
                    task_input.type = 'checkbox'
                    // task_input.checked = 'true'
                    if (content_list[i]['attrs']['checked']) {
                        task_input.setAttribute("checked", content_list[i]['attrs']['checked']);
                    }

                    task_input.disabled = true

                    new_node.classList.add('task-list-item')
                    // new_node.setAttribute('style', 'margin: 16px 0');
                    new_node.appendChild(task_input)
                }
                break

            case 'horizontal_rule':
                new_node = document.createElement('hr')
                break

            case 'blockquote':
                new_node = document.createElement('blockquote')
                break

            case 'code_block':

                new_node = document.createElement('pre')
                new_node.classList.add('hljs')
                new_node.classList.add('language-' + content_list[i]['attrs']['params'])

                // new_node = React.createElement('SyntaxHighlighter')

                // 直接渲染 code block 内的 HTML
                if ('content' in content_list[i] && content_list[i]['attrs']['params'] === 'html') {
                    if (content_list[i]['content'][0]['text'].indexOf('{HTML}') > -1) {
                        new_node = document.createElement('div')
                        new_node.classList.add('htmlBox')
                        new_node.innerHTML = content_list[i]['content'][0]['text'].replace('{HTML}', '')
                        // new_node.innerHTML = '<iframe style="border: 0; width: 100%; height: 120px;" src="https://bandcamp.com/EmbeddedPlayer/album=2906945127/size=large/bgcol=ffffff/linkcol=0687f5/tracklist=false/artwork=small/transparent=true/" seamless><a href="https://rhodadakar.bandcamp.com/album/as-tears-go-by">As Tears Go By by Rhoda Dakar</a></iframe>'
                    }
                }

                break

            case 'table':
                new_node = document.createElement('table')
                break

            case 'table_row':
                new_node = document.createElement('tr')
                break

            case 'table_header':
                new_node = document.createElement('th')
                break

            case 'table_cell':
                new_node = document.createElement('td')
                break

            case 'video': {
                const videoUrl = content_list[i]['attrs']['url'] || ''
                // 偵測 YouTube URL（youtu.be 短連結或 youtube.com）
                const ytMatch = videoUrl.match(
                    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/
                )
                if (ytMatch) {
                    const videoId = ytMatch[1]
                    new_node = document.createElement('div')
                    new_node.classList.add('youtube_embed')
                    new_node.innerHTML = `<iframe
                        src="https://www.youtube.com/embed/${videoId}"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                        style="width:100%; aspect-ratio:16/9; border-radius:6px;"
                    ></iframe>`
                } else {
                    new_node = document.createElement('video')
                    new_node.src = videoUrl
                    new_node.controls = true
                    new_node.setAttribute('style', 'width:100%; border-radius:6px;')
                }
                break
            }

            case 'math_inline':
                new_node = document.createElement('span')
                break

            case 'date':
                new_node = document.createElement('time')
                new_node.innerText = content_list[i]['attrs']['date']
                new_node.setAttribute('style', 'font-size: 0.85em; opacity: 0.65; margin: 0 2px;')
                break

            default:
                break

        }



        if (new_node !== undefined && parent_node !== undefined) {

            try {
                if (content_list[i]['type'] === 'numbered_list_item' || content_list[i]['type'] === 'bullet_list_item') {
                    // parent_node.appendChild(new_node)
                } else {
                    parent_node.appendChild(new_node)
                }


            } catch (error) {
                console.log(parent_node);
            }

        } else {
            console.log(parent_node);
        }

        if (new_node === undefined) {
            console.log(new_node);
            // new_node = parent_node
        }

        if (parent_node === undefined) {
            console.log(parent_node);
            // new_node = parent_node
        }


        // 如果还有子 content
        if ('content' in content_list[i]) {

            heptaContentTomd(content_list[i]['content'], new_node, parent_card_id, allCards)

        }

    }



    return parent_node

}


export { getHeptabaseData, getClearImag, getClearCard, heptaToMD }
