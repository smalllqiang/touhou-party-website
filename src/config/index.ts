/* ============================================================
 *  小游戏工具箱 —— 配置文件
 *  ------------------------------------------------------------
 *  改完这个文件后，开发模式下保存即生效（HMR）。
 *  构建产物不需要重新发布配置以外的任何东西。
 * ============================================================ */

/* ---------- 你画我猜 ---------- */
export interface DrawGuessConfigInput {
  /** 一个「A 画图」+ 一个「B 猜词」算一轮。例如 3 表示 3 轮 / 6 个阶段。 */
  rounds?: number
  /** a：A 阶段（画图）时长；b：B 阶段（看画、手写猜词）时长，单位秒。 */
  timer?: { a?: number; b?: number }
  /** true = 显示「时间到」后约 1.6 秒自动进入下一阶段；false = 等主持人手动点。 */
  autoNextOnTimeout?: boolean
  /** 选手名字（游戏开始前在界面上也能改）。 */
  players?: { a?: string; b?: string }
  /** 画板颜色（想加就加，想减就减）。 */
  colors?: string[]
  /** min / max：滑杆范围；defaultSize：每次开始时的默认粗细。 */
  brush?: { min?: number; max?: number; defaultSize?: number }
  /** 题目列表，随便增删改，一行一个。 */
  topics?: string[]
}

/* ---------- 谁是卧底 ---------- */
export type RawUndercoverTopic =
  | readonly unknown[]
  | {
      normal?: unknown
      spy?: unknown
      civilian?: unknown
      undercover?: unknown
      different?: unknown
      normalWord?: unknown
      spyWord?: unknown
      normalImage?: string
      normalImg?: string
      civilianImage?: string
      spyImage?: string
      spyImg?: string
      undercoverImage?: string
    }

export interface UndercoverConfigInput {
  /** 默认人数；游戏开始前在界面上随时能改。 */
  players?: number
  /** 界面上能调的范围。 */
  minPlayers?: number
  maxPlayers?: number
  /** 默认玩家名，不够的部分自动叫「玩家N」。 */
  names?: string[]
  /** 图片文件夹 + 默认后缀；没写 normalImage / spyImage 时按「文件夹 + 词 + 后缀」找图。 */
  imageDir?: string
  imageExt?: string
  topics?: RawUndercoverTopic[]
}

export interface GameConfig {
  drawGuess: DrawGuessConfigInput
  undercover: UndercoverConfigInput
}

export const GAME_CONFIG: GameConfig = {
  drawGuess: {
    rounds: 2,

    timer: {
      a: 150,
      b: 60,
    },

    autoNextOnTimeout: true,

    players: {
      a: '选手A',
      b: '选手B',
    },

    colors: [
      '#000000', // 黑
      '#7a7a7a', // 灰
      '#ffffff', // 白
      '#e02020', // 红
      '#ff8c1a', // 橙
      '#ffd400', // 黄
      '#37a745', // 绿
      '#1e88e5', // 蓝
      '#8e44ad', // 紫
      '#8b5a2b', // 棕
      '#f48fb1', // 粉
    ],

    brush: {
      min: 1,
      max: 48,
      defaultSize: 6,
    },

    topics: [
      '博丽灵梦',
      '雾雨魔理沙',
      '露米娅',
      '大妖精',
      '琪露诺',
      '红美铃',
      '小恶魔',
      '帕秋莉·诺蕾姬',
      '十六夜咲夜',
      '蕾米莉亚·斯卡蕾特',
      '芙兰朵露·斯卡蕾特',
      '冴月麟',
      '橙',
      '爱丽丝·玛格特洛依德',
      '莉莉霍瓦特',
      '魂魄妖梦',
      '西行寺幽幽子',
      '八云蓝',
      '八云紫',
      '伊吹萃香',
      '莉格露·奈特巴格',
      '米斯蒂娅·萝蕾拉',
      '上白泽慧音',
      '因幡帝',
      '铃仙·优昙华院·因幡',
      '八意永琳',
      '蓬莱山辉夜',
      '藤原妹红',
      '梅蒂欣·梅兰可莉',
      '风见幽香',
      '小野塚小町',
      '四季映姬·夜摩仙那度',
      '秋静叶',
      '秋穰子',
      '键山雏',
      '河城荷取',
      '犬走椛',
      '东风谷早苗',
      '八坂神奈子',
      '洩矢诹访子',
      '永江衣玖',
      '比那名居天子',
      '大鲶鱼',
      '琪斯美',
      '黑谷山女',
      '水桥帕露西',
      '星熊勇仪',
      '古明地觉',
      '火焰猫燐',
      '灵乌路空',
      '古明地恋',
      '娜兹玲',
      '多多良小伞',
      '云居一轮&云山',
      '村纱水蜜',
      '寅丸星',
      '圣白莲',
      '封兽鵺',
      '姬海棠果',
      '幽谷响子',
      '宫古芳香',
      '霍青娥',
      '苏我屠自古',
      '物部布都',
      '丰聪耳神子',
      '二岩猯藏',
      '秦心',
      '若鹭姬',
      '赤蛮奇',
      '今泉影狼',
      '九十九弁弁',
      '九十九八桥',
      '鬼人正邪',
      '少名针妙丸',
      '堀川雷鼓',
      '宇佐见堇子',
      '清兰',
      '铃瑚',
      '哆来咪·苏伊特',
      '稀神探女',
      '克劳恩皮丝',
      '纯狐',
      '赫卡提亚·拉碧斯拉祖利',
      '依神女苑',
      '依神紫苑',
      '爱塔妮缇拉尔瓦',
      '坂田合欢',
      '高丽野阿吽',
      '矢田寺成美',
      '尔子田里乃',
      '丁礼田舞',
      '摩多罗隐岐奈',
      '戎璎花',
      '牛崎润美',
      '庭渡久侘歌',
      '吉吊八千慧',
      '杖刀偶磨弓',
      '埴安神袿姬',
      '骊驹早鬼',
      '饕餮尤魔',
      '豪德寺三花',
      '山城高岭',
      '驹草山如',
      '玉造魅须丸',
      '菅牧典',
      '饭纲丸龙',
      '天弓千亦',
      '姬虫百百世',
      '孙美天',
      '三头慧之子',
      '天火人血枪',
      '豫母都日狭美',
      '日白残无',
      '尘塚姥芽',
      '封兽魑魅',
      '道神驯子',
      '维缦·浅间',
      '磐永阿梨夜',
      '渡里贝子',
      '森近霖之助',
      '无名的读书妖怪（朱鹭子）',
      '桑尼米尔克',
      '露娜切露德',
      '斯塔萨菲雅',
      '射命丸文',
      '稗田阿求',
      '绵月丰姬',
      '绵月依姬',
      'Reisen（铃仙二号）',
      '茨木华扇',
      '本居小铃',
      '宫出口瑞灵',
      '奥野田美宵',
      '宇佐见莲子',
      '玛艾露贝莉·赫恩（梅莉）',
      '王天兴',
      'sq',
      '崴の寺子屋',
      '梦环翠海',
      '麻辣香锅',
      'he4',
      '过程淘汰',
    ],
  },

  undercover: {
    players: 4,
    minPlayers: 3,
    maxPlayers: 12,

    /* 默认玩家名（可以留空）。例如 ['小明', '小红']，不够的部分自动叫「玩家4」「玩家5」… */
    names: [],

    /* 没写 normalImage / spyImage 时，自动按「图片文件夹 + 词 + 后缀」找图。
     * 例如「可乐」-> public/images/undercover/可乐.png
     * 如果你的图是 jpg，把 imageExt 改成 '.jpg' 就行。 */
    imageDir: 'images/undercover/',
    imageExt: '.png',

    /* 一组题 = 两个词：normal 是普通玩家看到的，spy 是卧底看到的。
     * 两个词越像越好玩。支持三种写法：
     *   { normal: '可乐', spy: '雪碧' }
     *   { normal: '猫', spy: '老虎', normalImage: 'cat.png', spyImage: 'tiger.jpg' }
     *   ['可乐', '雪碧', 'cola.png', 'sprite.png']
     */
    topics: [
      { normal: '棍母棍母棍', spy: '母棍母棍母' }, // 测试用
      { normal: '姬海棠果', spy: '射命丸文' },
      { normal: '射命丸文', spy: '姬海棠果' },
      { normal: '天弓千亦', spy: '埴安神袿姬' },
      { normal: '埴安神袿姬', spy: '天弓千亦' },
      { normal: '帕秋莉', spy: '稗田阿求' },
      { normal: '稗田阿求', spy: '帕秋莉' },
      { normal: '蕾米', spy: '琪露诺' },
      { normal: '琪露诺', spy: '蕾米' },
      { normal: '因幡帝', spy: '铃仙' },
      { normal: '铃仙', spy: '因幡帝' },
      { normal: '橙', spy: '火焰猫燐' },
      { normal: '火焰猫燐', spy: '橙' },
      { normal: '风见幽香', spy: '四季映姬' },
      { normal: '四季映姬', spy: '风见幽香' },
      { normal: '恋&觉', spy: '芙兰&蕾米' },
      { normal: '芙兰&蕾米', spy: '恋&觉' },
      { normal: '桑尼&露娜&斯塔', spy: '露娜萨&梅露兰&莉莉卡' },
      { normal: '露娜萨&梅露兰&莉莉卡', spy: '桑尼&露娜&斯塔' },
      { normal: '冴月麟', spy: '棍母' },
      { normal: '梦环翠海', spy: '崴の寺子屋' },
    ],
  },
}
