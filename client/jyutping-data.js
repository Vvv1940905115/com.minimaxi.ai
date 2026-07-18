// 粤语拼音（Jyutping）对照表 —— 用于克隆音色（通用 TTS）自动标注粤语发音。
// MiniMax 克隆音色默认按普通话读音，需在汉字后加 (jyutping) 才能说粤语。
// 这里收录常用粤语字（多为普通话/粤语读音不同的字），合成时自动转换。
// 不在表中的字会原样保留（按普通话读），如需可手动加 (xxx) 标注。
(function () {
    'use strict';

    const JYUTPING_MAP = {
        // 代词 / 助词
        '我': 'ngo5', '你': 'nei5', '佢': 'keoi5', '哋': 'dei6',
        '唔': 'm4', '係': 'hai6', '嘅': 'ge3', '咗': 'zo2',
        '咁': 'gam3', '咩': 'me1', '嘢': 'je5', '啲': 'di1',
        '冇': 'mou5', '有': 'jau5', '喺': 'hai2', '喇': 'laa3',
        '咯': 'lo1', '囉': 'lo1', '㗎': 'gaa3', '喎': 'wo3',
        '咪': 'mai5', '啩': 'gwaa3', '吖': 'aa1', '啦': 'laa1',
        '㗎': 'gaa3', '咦': 'ji4', '喔': 'o1', '噉': 'gam2',

        // 动词 / 动作
        '去': 'heoi3', '返': 'faan1', '行': 'haang4', '走': 'zau2',
        '睇': 'tai2', '食': 'sik6', '飲': 'jam2', '瞓': 'fan3',
        '唞': 'tau2', '學': 'hok6', '講': 'gong2', '聽': 'teng1',
        '話': 'waa6', '知': 'zi1', '做': 'zou6', '買': 'maai5',
        '賣': 'maai6', '搵': 'wan2', '攞': 'lo2', '拎': 'ling1',
        '郁': 'juk1', '睇': 'tai2', '郁': 'juk1', '郁': 'juk1',

        // 形容词
        '靚': 'leng3', '叻': 'lek1', '衰': 'seoi1', '啱': 'ngaam1',
        '錯': 'co3', '鍾': 'zung1', '幾': 'gei2', '多': 'do1',
        '少': 'siu2', '快': 'faai3', '慢': 'maan6', '濕': 'sap1',
        '乾': 'gon1', '凍': 'dung3', '熱': 'jit6', '甜': 'tim4',
        '酸': 'syun1', '苦': 'fu2', '辣': 'laat6', '鹹': 'haam4',
        '肥': 'fei4', '瘦': 'sau3', '矮': 'ngai2', '高': 'gou1',

        // 名词
        '錢': 'cin2', '廣': 'gwong2', '東': 'dung1', '屋': 'uk1',
        '飯': 'faan6', '面': 'min6', '茶': 'caa4', '餅': 'beng2',
        '魚': 'jyu4', '肉': 'juk6', '蛋': 'daan2', '街': 'gaai1',
        '市': 'si5', '該': 'goi1', '嘢': 'je5', '嘢': 'je5',
        '嘢': 'je5', '嘢': 'je5', '嘢': 'je5', '嘢': 'je5',

        // 数字
        '一': 'jat1', '二': 'ji6', '三': 'saam1', '四': 'sei3',
        '五': 'ng5', '六': 'luk6', '七': 'cat1', '八': 'baat3',
        '九': 'gau2', '十': 'sap6', '百': 'baak3', '千': 'cin1',
        '萬': 'man6', '零': 'ling4',

        // 常用疑问 / 其他
        '點': 'dim2', '解': 'gaai2', '邊': 'bin1', '度': 'dou6',
        '嘥': 'saai1', '晒': 'saai3', '埋': 'maai4', '添': 'tim1',
        '仲': 'zung6', '先': 'sin1', '而': 'ji4', '家': 'gaa1',
        '唔': 'm4', '係': 'hai6', '咁': 'gam3', '嘅': 'ge3'
    };

    // 把文本转为带粤拼标注的形式。已带 (xxx) 标注的字不重复处理。
    function toJyutping(text) {
        if (!text) return text;
        let out = '';
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const jp = JYUTPING_MAP[ch];
            // 若该字已有手动标注（后接 '('），跳过；否则自动加粤拼
            if (jp && text[i + 1] !== '(') {
                out += ch + '(' + jp + ')';
            } else {
                out += ch;
            }
        }
        return out;
    }

    window.JYUTPING_MAP = JYUTPING_MAP;
    window.toJyutping = toJyutping;
})();
