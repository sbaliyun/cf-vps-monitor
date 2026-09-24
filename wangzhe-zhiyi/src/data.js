'use strict';
/* 王者之弈 · 数据：英雄、羁绊、装备、奇遇、事件、关卡 */
window.G = window.G || {};
(function (G) {
  G.COLS = 7; G.ROWS = 8; G.BENCH = 9;
  G.COST_COLORS = ['#000', '#A9B3BD', '#44C47C', '#3F92F2', '#B862F2', '#F4B63C'];
  G.POOL_SIZE = [0, 29, 22, 18, 12, 10];
  G.SHOP_ODDS = {
    1: [100, 0, 0, 0, 0], 2: [100, 0, 0, 0, 0], 3: [75, 25, 0, 0, 0], 4: [55, 30, 15, 0, 0],
    5: [45, 33, 20, 2, 0], 6: [30, 40, 25, 5, 0], 7: [19, 35, 35, 10, 1], 8: [18, 25, 32, 22, 3],
    9: [10, 20, 25, 35, 10], 10: [5, 10, 20, 40, 25]
  };
  G.XP_NEED = [0, 2, 2, 6, 10, 20, 36, 56, 80, 100, 0];
  G.MAX_LEVEL = 10;

  /* ---------- 羁绊 ---------- */
  G.TRAITS = {
    warrior: { type: 'class', name: '战士', glyph: '战', color: '#E4744A', breaks: [2, 4, 6],
      desc: '成吨血量，扛住前排冲击。战士获得额外最大生命值。',
      tiers: ['+250 最大生命', '+550 最大生命', '+1000 最大生命'], vals: [250, 550, 1000] },
    mage: { type: 'class', name: '法师', glyph: '法', color: '#9272F2', breaks: [2, 4, 6],
      desc: '魔力爆发，轰碎敌方阵型。法师获得法术强度。',
      tiers: ['+25 法术强度', '+60 法术强度', '+110 法术强度'], vals: [25, 60, 110] },
    hunter: { type: 'class', name: '猎人', glyph: '猎', color: '#4DBF70', breaks: [2, 4, 6],
      desc: '精准狙击，收割残血目标。猎人获得攻击速度，对生命低于 50% 的目标造成额外伤害。',
      tiers: ['+25% 攻速，残血增伤 10%', '+55% 攻速，残血增伤 20%', '+100% 攻速，残血增伤 35%'],
      vals: [[25, 10], [55, 20], [100, 35]] },
    assassin: { type: 'class', name: '刺客', glyph: '刺', color: '#D6466E', breaks: [2, 4, 6],
      desc: '暗影突袭，秒掉核心输出。开战时刺客跃向敌方后排，并获得暴击率与暴击伤害。',
      tiers: ['+15% 暴击率，+20% 暴伤', '+30% 暴击率，+50% 暴伤', '+45% 暴击率，+90% 暴伤'],
      vals: [[15, 20], [30, 50], [45, 90]] },
    support: { type: 'class', name: '辅助', glyph: '辅', color: '#43B8D8', breaks: [2, 4],
      desc: '全能增益，盘活全队战力。开战时全队获得护盾与法力。',
      tiers: ['全队 180 护盾，+10 法力', '全队 400 护盾，+25 法力'], vals: [[180, 10], [400, 25]] },
    changan: { type: 'faction', name: '长安', glyph: '长', color: '#E8B04A', breaks: [2, 4, 6],
      desc: '大唐长安，法度森严。长安英雄造成的伤害提高。',
      tiers: ['+12% 伤害', '+28% 伤害', '+50% 伤害'], vals: [12, 28, 50] },
    sanfen: { type: 'faction', name: '三分', glyph: '三', color: '#DB5550', breaks: [2, 4, 6],
      desc: '三分之地，群雄逐鹿。三分英雄获得全能吸血。',
      tiers: ['12% 全能吸血', '25% 全能吸血', '40% 全能吸血'], vals: [12, 25, 40] },
    jixia: { type: 'faction', name: '稷下', glyph: '稷', color: '#5DA9E9', breaks: [2, 4, 6],
      desc: '稷下学院，百家争鸣。稷下英雄施放技能后回复法力。',
      tiers: ['施法后回复 15 法力', '施法后回复 35 法力', '施法后回复 60 法力'], vals: [15, 35, 60] },
    changcheng: { type: 'faction', name: '长城', glyph: '城', color: '#A3B0BE', breaks: [2, 4],
      desc: '长城守卫军，寸土不让。长城英雄获得护甲与魔抗。',
      tiers: ['+30 护甲与魔抗', '+70 护甲与魔抗'], vals: [30, 70] },
    chuhan: { type: 'faction', name: '楚汉', glyph: '楚', color: '#C8423A', breaks: [2, 4],
      desc: '楚汉争霸，背水一战。楚汉英雄首次生命低于 50% 时获得护盾与攻速。',
      tiers: ['30% 最大生命护盾，+30% 攻速', '60% 最大生命护盾，+60% 攻速'], vals: [30, 60] },
    shenhua: { type: 'faction', name: '神话', glyph: '神', color: '#F0C75E', breaks: [2, 4],
      desc: '上古神话，神力觉醒。战斗中神话英雄每 3 秒叠加一层攻击力与法术强度（最多 8 层）。',
      tiers: ['每层 +8% 攻击与法强', '每层 +16% 攻击与法强'], vals: [8, 16] }
  };
  G.TRAIT_ORDER = ['warrior', 'mage', 'hunter', 'assassin', 'support', 'changan', 'sanfen', 'jixia', 'changcheng', 'chuhan', 'shenhua'];

  /* ---------- 英雄 ---------- */
  const SK = '#FBE0CC';
  G.HEROES = {};
  G.HERO_LIST = [];
  function H(id, name, title, cost, traits, st, skill, look) {
    const h = Object.assign({ id, name, title, cost, traits, skill, look }, st);
    h.look.skin = h.look.skin || SK;
    G.HEROES[id] = h; G.HERO_LIST.push(h);
  }
  // st: hp ad as range armor mr mana sm(初始法力)
  /* 一费 */
  H('direnjie', '狄仁杰', '断案大师', 1, ['hunter', 'changan'],
    { hp: 520, ad: 48, as: 0.75, range: 4, armor: 20, mr: 20, mana: 60, sm: 0 },
    { name: '王朝密令', desc: '向目标连掷 3 枚令牌，每枚造成 {0} 物理伤害。', v: [[75, 115, 185]] },
    { hair: '#2A2530', hs: 'short', out: '#B22A2A', out2: '#E6B94A', style: 'robe', wp: 'card', wc: '#E6B94A', hat: 'guan' });
  H('liyuanfang', '李元芳', '王都密探', 1, ['hunter', 'changan'],
    { hp: 500, ad: 50, as: 0.8, range: 3, armor: 20, mr: 20, mana: 50, sm: 0 },
    { name: '刺杀令', desc: '向生命值最低的敌人掷出飞刀，造成 {0} 物理伤害；若击杀则返还 30 法力。', v: [[190, 290, 460]] },
    { hair: '#6A4428', hs: 'short', out: '#3E7A5A', out2: '#D9B36A', style: 'coat', wp: 'dagger', wc: '#CFD8E0', ext: ['beastEars'] });
  H('laofuzi', '老夫子', '万古长明', 1, ['warrior', 'jixia'],
    { hp: 680, ad: 52, as: 0.6, range: 1, armor: 40, mr: 30, mana: 80, sm: 20 },
    { name: '圣人训诫', desc: '用戒尺训诫目标，眩晕 {1} 秒并造成 {0} 魔法伤害。', v: [[150, 250, 400], [1.5, 2, 2.5]] },
    { hair: '#EDEDED', hs: 'topknot', out: '#7C6A9E', out2: '#F1E4C0', style: 'robe', wp: 'ruler', wc: '#C89A5A', ext: ['beardLong'], beard: '#F4F4F4' });
  H('mozi', '墨子', '和平守望', 1, ['mage', 'jixia'],
    { hp: 560, ad: 40, as: 0.6, range: 3, armor: 30, mr: 25, mana: 80, sm: 20 },
    { name: '和平守望', desc: '发射机关炮，对目标及周围 1 格敌人造成 {0} 魔法伤害，自身获得 {1} 护盾。', v: [[180, 280, 450], [150, 250, 400]] },
    { hair: '#9AA0A8', hs: 'short', out: '#5C6B78', out2: '#E0A43A', style: 'armor', wp: 'cannon', wc: '#8A96A3', ext: ['goggles', 'beard'], beard: '#B8BDC4' });
  H('liubei', '刘备', '仁德义枪', 1, ['warrior', 'sanfen'],
    { hp: 660, ad: 54, as: 0.65, range: 1, armor: 38, mr: 30, mana: 80, sm: 20 },
    { name: '以德服人', desc: '获得 {0} 护盾，并对周围 1 格敌人造成 {1} 物理伤害。', v: [[260, 400, 650], [100, 160, 260]] },
    { hair: '#2B2420', hs: 'topknot', out: '#2F6E3E', out2: '#E6C36A', style: 'coat', wp: 'gun', wc: '#5A4A3A', ext: ['beardSmall'], beard: '#2B2420' });
  H('sulie', '苏烈', '不屈铁壁', 1, ['support', 'changcheng'],
    { hp: 760, ad: 45, as: 0.55, range: 1, armor: 45, mr: 35, mana: 100, sm: 40 },
    { name: '豪烈万军', desc: '重击地面，眩晕周围 1 格敌人 {1} 秒并造成 {0} 魔法伤害。', v: [[120, 200, 320], [1.2, 1.5, 2]] },
    { hair: '#2A2420', hs: 'short', out: '#7A5A3A', out2: '#C9A15A', style: 'armor', wp: 'hammer', wc: '#8C959E', hat: 'helmet', hatc: '#6E7B8A', ext: ['beard'], beard: '#2A2420', bulk: 1.15 });
  H('xiaoqiao', '小乔', '恋之微风', 1, ['mage', 'sanfen'],
    { hp: 480, ad: 40, as: 0.6, range: 3, armor: 20, mr: 20, mana: 70, sm: 10 },
    { name: '星华缭乱', desc: '唤来流星，对目标及周围 1 格敌人造成 {0} 魔法伤害。', v: [[210, 320, 500]] },
    { hair: '#F2A15A', hs: 'twinbun', out: '#F19BB5', out2: '#FFF1C2', style: 'dress', wp: 'fan', wc: '#FF7FA6', ext: ['flower'] });
  H('yuji', '虞姬', '森之风灵', 1, ['hunter', 'chuhan'],
    { hp: 480, ad: 50, as: 0.75, range: 4, armor: 20, mr: 20, mana: 60, sm: 0 },
    { name: '阵前舞', desc: '免疫普攻伤害 {0} 秒，并提升 {1}% 攻速，持续 4 秒。', v: [[1.5, 2, 3], [50, 70, 100]] },
    { hair: '#3A2E4A', hs: 'long', out: '#E9E2F6', out2: '#8F6BC8', style: 'dress', wp: 'bow', wc: '#7A4FB0', ext: ['flower'] });
  /* 二费 */
  H('mulan', '花木兰', '传说之刃', 2, ['warrior', 'changcheng'],
    { hp: 760, ad: 62, as: 0.7, range: 1, armor: 40, mr: 30, mana: 70, sm: 0 },
    { name: '绽放刀锋', desc: '旋转斩击周围 1 格敌人，造成 {0} 物理伤害，并回复 {1} 生命。', v: [[200, 320, 520], [150, 250, 400]] },
    { hair: '#2A1E24', hs: 'ponytail', out: '#B03A3A', out2: '#E6C16A', style: 'armor', wp: 'greatsword', wc: '#D8DEE6', ext: ['headband'], bandc: '#E84A4A' });
  H('xuance', '百里玄策', '嚣狂之镰', 2, ['assassin', 'changcheng'],
    { hp: 560, ad: 64, as: 0.85, range: 1, armor: 25, mr: 25, mana: 60, sm: 0 },
    { name: '狂热序章', desc: '甩出锁镰突袭生命值最低的敌人，造成 {0} 物理伤害并眩晕 0.75 秒。', v: [[250, 380, 600]] },
    { hair: '#EDEAE4', hs: 'spiky', out: '#2E3440', out2: '#C83A3A', style: 'coat', wp: 'sickle', wc: '#B8C2CC', ext: ['scarf'], scarfc: '#C83A3A' });
  H('sunshangxiang', '孙尚香', '千金重弩', 2, ['hunter', 'sanfen'],
    { hp: 530, ad: 58, as: 0.75, range: 4, armor: 20, mr: 20, mana: 70, sm: 0 },
    { name: '究极弩炮', desc: '发射炮弹，对目标造成 {0} 物理伤害，并对周围 1 格敌人造成一半溅射伤害。', v: [[300, 450, 700]] },
    { hair: '#F29B38', hs: 'twin', out: '#E07A2E', out2: '#FFF0D0', style: 'dress', wp: 'handcannon', wc: '#6B4A36' });
  H('zhangliang', '张良', '言灵之书', 2, ['mage', 'jixia'],
    { hp: 560, ad: 42, as: 0.6, range: 3, armor: 22, mr: 30, mana: 80, sm: 30 },
    { name: '言灵·操纵', desc: '压制目标 {1} 秒，期间共造成 {0} 魔法伤害。', v: [[300, 450, 700], [1.5, 2, 2.5]] },
    { hair: '#1E1C28', hs: 'long', out: '#3D5A99', out2: '#E8D08A', style: 'robe', wp: 'book', wc: '#C8423A', hat: 'scholar', hatc: '#27324F' });
  H('zhuangzhou', '庄周', '逍遥幻梦', 2, ['support', 'jixia'],
    { hp: 720, ad: 45, as: 0.6, range: 2, armor: 35, mr: 35, mana: 80, sm: 30 },
    { name: '蝶梦', desc: '为生命值最低的 2 名友军回复 {0} 生命并解除控制，2 秒内免疫控制。', v: [[200, 300, 480]] },
    { hair: '#CFE6F2', hs: 'long', out: '#8FD3E8', out2: '#FFFFFF', style: 'robe', wp: 'fan', wc: '#9EDFF2', ext: ['butterfly'] });
  H('liubang', '刘邦', '双面君主', 2, ['support', 'chuhan'],
    { hp: 780, ad: 50, as: 0.6, range: 1, armor: 45, mr: 35, mana: 100, sm: 40 },
    { name: '汉王之盾', desc: '为全体友军提供 {0} 护盾，持续 4 秒。', v: [[150, 250, 380]] },
    { hair: '#2B2420', hs: 'topknot', out: '#3B4B8C', out2: '#E3BE5C', style: 'armor', wp: 'shield', wc: '#C9A24A', hat: 'crownSmall', ext: ['beardSmall', 'cape'], beard: '#2B2420', capec: '#8C1D1D' });
  H('peiqinhu', '裴擒虎', '六合虎拳', 2, ['assassin', 'changan'],
    { hp: 600, ad: 60, as: 0.8, range: 1, armor: 28, mr: 25, mana: 60, sm: 0 },
    { name: '猛虎化身', desc: '化身猛虎扑向目标造成 {0} 物理伤害，5 秒内攻击力 +{1}%、攻速 +40%。', v: [[150, 230, 360], [30, 45, 70]] },
    { hair: '#6B3E1E', hs: 'short', out: '#E8912E', out2: '#2A1E18', style: 'coat', wp: 'claw', wc: '#E8E4DA', hat: 'tiger' });
  H('yangjian', '杨戬', '根源之目', 2, ['warrior', 'shenhua'],
    { hp: 760, ad: 60, as: 0.65, range: 1, armor: 40, mr: 30, mana: 80, sm: 20 },
    { name: '啸天击', desc: '哮天犬扑击目标，造成 {0} 物理伤害并击飞 1 秒。', v: [[220, 340, 540]] },
    { hair: '#1E1E2A', hs: 'long', out: '#C8CED6', out2: '#3A4A6A', style: 'armor', wp: 'trident', wc: '#DCE2EA', ext: ['thirdEye', 'dog'] });
  /* 三费 */
  H('diaochan', '貂蝉', '绝世舞姬', 3, ['mage', 'assassin', 'sanfen'],
    { hp: 660, ad: 50, as: 0.7, range: 1, armor: 30, mr: 30, mana: 60, sm: 0 },
    { name: '绽·风华', desc: '在周围 1 格绽放花阵，造成 {0} 魔法伤害，每命中一名敌人回复 {1} 生命。', v: [[260, 380, 600], [60, 90, 140]] },
    { hair: '#3B2340', hs: 'bun', out: '#D0569A', out2: '#FFD6E8', style: 'dress', wp: 'ribbon', wc: '#FF8CC6', ext: ['flower', 'petals'] });
  H('hanxin', '韩信', '国士无双', 3, ['assassin', 'warrior', 'chuhan'],
    { hp: 700, ad: 68, as: 0.8, range: 1, armor: 35, mr: 30, mana: 70, sm: 0 },
    { name: '国士无双', desc: '长枪横扫目标及周围 1 格敌人，造成 {0} 物理伤害并击飞 0.75 秒。', v: [[250, 380, 600]] },
    { hair: '#1C1C28', hs: 'ponytail', out: '#2F5DA8', out2: '#E6B94A', style: 'armor', wp: 'spear', wc: '#D8DEE6', ext: ['scarf'], scarfc: '#E6B94A' });
  H('shouyue', '百里守约', '静谧之眼', 3, ['hunter', 'changcheng'],
    { hp: 560, ad: 80, as: 0.55, range: 5, armor: 22, mr: 22, mana: 60, sm: 0 },
    { name: '狂风之息', desc: '狙击距离最远的敌人，造成 {0} 物理伤害。', v: [[400, 600, 950]] },
    { hair: '#DAD6CC', hs: 'short', out: '#3F5B4C', out2: '#C9B27A', style: 'coat', wp: 'rifle', wc: '#4A4038', ext: ['scarf'], scarfc: '#6B8F7A' });
  H('change', '嫦娥', '寒月公主', 3, ['mage', 'shenhua'],
    { hp: 760, ad: 45, as: 0.6, range: 2, armor: 35, mr: 40, mana: 70, sm: 20 },
    { name: '月光之舞', desc: '引动月华，对目标及周围 1 格敌人造成 {0} 魔法伤害，并将伤害的 50% 转化为护盾。', v: [[240, 360, 560]] },
    { hair: '#F3F4FA', hs: 'long', out: '#DCE8FA', out2: '#8FB0E8', style: 'dress', wp: 'orb', wc: '#CFE3FF', ext: ['moon'] });
  H('guiguzi', '鬼谷子', '万物有灵', 3, ['support', 'jixia'],
    { hp: 780, ad: 45, as: 0.6, range: 1, armor: 45, mr: 45, mana: 90, sm: 30 },
    { name: '元气磁场', desc: '引爆元气，眩晕周围 2 格内的敌人 {1} 秒并造成 {0} 魔法伤害。', v: [[100, 160, 260], [1.2, 1.6, 2.2]] },
    { hair: '#3A4A3A', hs: 'short', out: '#4E6E58', out2: '#D6C27A', style: 'robe', wp: 'orb', wc: '#7CF0B0', hat: 'hood', hatc: '#35503E', ext: ['mask'] });
  H('gongsunli', '公孙离', '幻舞玲珑', 3, ['hunter', 'assassin', 'changan'],
    { hp: 560, ad: 64, as: 0.8, range: 3, armor: 22, mr: 22, mana: 50, sm: 0 },
    { name: '孤鹜断霞', desc: '闪身躲开 1 秒内所有攻击，之后 3 次普攻额外造成 {0} 魔法伤害。', v: [[80, 120, 190]] },
    { hair: '#F6E3D8', hs: 'long', out: '#F28FA6', out2: '#FFFFFF', style: 'dress', wp: 'umbrella', wc: '#F28FA6', ext: ['foxEars', 'tail'] });
  H('zhaoyun', '赵云', '苍天翔龙', 3, ['warrior', 'assassin', 'sanfen'],
    { hp: 720, ad: 66, as: 0.75, range: 1, armor: 40, mr: 30, mana: 70, sm: 0 },
    { name: '天翔之龙', desc: '跃向目标，对周围 1 格敌人造成 {0} 物理伤害并击飞 1 秒。', v: [[230, 350, 550]] },
    { hair: '#1C1C28', hs: 'short', out: '#EDEFF2', out2: '#3F7FD6', style: 'armor', wp: 'spear', wc: '#E8EEF6', hat: 'helmet', hatc: '#DADFE6', plume: '#3F7FD6' });
  /* 四费 */
  H('houyi', '后羿', '半神之弓', 4, ['hunter', 'shenhua'],
    { hp: 700, ad: 78, as: 0.8, range: 4, armor: 25, mr: 25, mana: 80, sm: 0 },
    { name: '灼日之矢', desc: '被动：普攻叠加灼焰印记，每层 +4% 暴击率、+3% 伤害（最多 10 层）。主动：射出巨型火焰箭，沿直线造成 {0} 魔法伤害，首个命中者眩晕 {1} 秒。', v: [[450, 700, 1500], [2, 2.5, 4]] },
    { hair: '#F2C04E', hs: 'spiky', out: '#E8A33A', out2: '#FFF1B8', style: 'armor', wp: 'bow', wc: '#FFC83A', ext: ['sunband', 'cape'], capec: '#C9412E' });
  H('zhugeliang', '诸葛亮', '绝代智谋', 4, ['mage', 'sanfen'],
    { hp: 720, ad: 50, as: 0.65, range: 3, armor: 28, mr: 35, mana: 70, sm: 20 },
    { name: '元气弹', desc: '对生命值最低的敌人发射元气弹，造成 {0} 魔法伤害；若击杀则立即再次施放（最多 3 次）。', v: [[450, 700, 1600]] },
    { hair: '#1E1C28', hs: 'long', out: '#EAF0F5', out2: '#4A6FB0', style: 'robe', wp: 'featherfan', wc: '#FFFFFF', hat: 'scholar', hatc: '#EAF0F5' });
  H('xiangyu', '项羽', '西楚霸王', 4, ['warrior', 'chuhan'],
    { hp: 1000, ad: 74, as: 0.65, range: 1, armor: 55, mr: 40, mana: 100, sm: 40 },
    { name: '霸王斩', desc: '蓄力斩击周围 1 格敌人，造成 {0} 物理伤害并眩晕 1.5 秒，自身获得 {1} 护盾。', v: [[300, 450, 1200], [400, 650, 1500]] },
    { hair: '#1C1C20', hs: 'short', out: '#7A1F1F', out2: '#1E1E24', style: 'armor', wp: 'halberd', wc: '#3A3A44', hat: 'helmet', hatc: '#3A3A44', ext: ['beard', 'cape'], beard: '#1C1C20', capec: '#A82424', bulk: 1.18 });
  H('shangguan', '上官婉儿', '惊鸿之笔', 4, ['mage', 'assassin', 'changan'],
    { hp: 700, ad: 55, as: 0.7, range: 2, armor: 28, mr: 30, mana: 60, sm: 0 },
    { name: '章草·横鳞', desc: '腾空挥毫，在目标区域连书 4 笔，每笔对周围 1 格造成 {0} 魔法伤害；施法期间不可选中。', v: [[120, 180, 400]] },
    { hair: '#23202A', hs: 'bun', out: '#F2D5E2', out2: '#6A3A6A', style: 'dress', wp: 'brush', wc: '#2A2230', ext: ['flower'] });
  H('kai', '铠', '破灭之刃', 4, ['warrior', 'changcheng'],
    { hp: 950, ad: 78, as: 0.7, range: 1, armor: 55, mr: 40, mana: 80, sm: 20 },
    { name: '堕落之铠', desc: '化身魔铠 8 秒：攻击力 +50%、攻速 +30%，每次普攻回复 {0} 生命。', v: [[40, 60, 150]] },
    { hair: '#E8ECF2', hs: 'spiky', out: '#2E3950', out2: '#58C7F2', style: 'armor', wp: 'greatsword', wc: '#7FD6FF', hat: 'helmetHorn', hatc: '#2E3950' });
  H('nezha', '哪吒', '桀骜炎枪', 4, ['warrior', 'shenhua'],
    { hp: 900, ad: 70, as: 0.7, range: 1, armor: 50, mr: 40, mana: 90, sm: 30 },
    { name: '乾坤天罡', desc: '飞向距离最远的敌人，用乾坤圈束缚 {1} 秒并造成 {0} 物理伤害。', v: [[300, 450, 1000], [2, 2.5, 4]] },
    { hair: '#1E1A20', hs: 'twinbun', out: '#E24A3B', out2: '#F4C04A', style: 'coat', wp: 'spear', wc: '#FF5A3A', ext: ['ring', 'scarf'], scarfc: '#FF4A3A' });
  /* 五费 */
  H('lvbu', '吕布', '无双之魔', 5, ['warrior', 'sanfen'],
    { hp: 1150, ad: 92, as: 0.75, range: 1, armor: 55, mr: 45, mana: 100, sm: 30 },
    { name: '魔神降世', desc: '跃向敌人最密集处，造成 {0} 物理伤害并击飞 1 秒；之后 8 秒获得 40% 全能吸血，普攻造成真实伤害。', v: [[400, 700, 3000]] },
    { hair: '#1C1C20', hs: 'short', out: '#6A2A2A', out2: '#E6B94A', style: 'armor', wp: 'halberd', wc: '#E6B94A', hat: 'featherHelm', hatc: '#C99A3A', ext: ['cape'], capec: '#8B1E1E', bulk: 1.15 });
  H('nvwa', '女娲', '至高创世', 5, ['mage', 'shenhua'],
    { hp: 860, ad: 55, as: 0.65, range: 4, armor: 30, mr: 45, mana: 100, sm: 40 },
    { name: '补天', desc: '召唤陨星砸向敌人最密集处，对半径 2 格造成 {0} 魔法伤害并眩晕 1.5 秒。', v: [[520, 820, 4000]] },
    { hair: '#1D2B3A', hs: 'long', out: '#6FC2A6', out2: '#F4D06A', style: 'dress', wp: 'orb', wc: '#FFE27A', ext: ['halo', 'snakeTail'] });
  H('wuzetian', '武则天', '女帝', 5, ['mage', 'changan'],
    { hp: 860, ad: 55, as: 0.65, range: 4, armor: 30, mr: 45, mana: 110, sm: 50 },
    { name: '生杀予夺', desc: '神之手降临，对全体敌人造成 {0} 魔法伤害并眩晕 {1} 秒。', v: [[240, 380, 2000], [1, 1.5, 4]] },
    { hair: '#1E1824', hs: 'bun', out: '#6B2F8F', out2: '#F0C75E', style: 'robe', wp: 'orb', wc: '#C07CFF', hat: 'crown' });
  H('libai', '李白', '青莲剑仙', 5, ['assassin', 'changan'],
    { hp: 860, ad: 98, as: 0.9, range: 1, armor: 35, mr: 30, mana: 70, sm: 0 },
    { name: '青莲剑歌', desc: '化身剑气不可选中 1.5 秒，对半径 2 格内所有敌人连斩 4 次，每次造成 {0} 物理伤害。', v: [[150, 240, 1000]] },
    { hair: '#DDE3EA', hs: 'ponytail', out: '#E8EEF4', out2: '#4F8FD6', style: 'robe', wp: 'sword', wc: '#BFE6FF', ext: ['gourd', 'scarf'], scarfc: '#5DA9E9' });
  H('jiangziya', '姜子牙', '封神', 5, ['mage', 'support', 'jixia'],
    { hp: 900, ad: 55, as: 0.6, range: 4, armor: 35, mr: 45, mana: 100, sm: 40 },
    { name: '断罪', desc: '蓄力后沿直线降下天罡光柱，造成 {0} 魔法伤害，并为全体友军回复 {1} 法力。', v: [[500, 800, 3500], [30, 40, 100]] },
    { hair: '#F2F2F2', hs: 'topknot', out: '#7F8C4E', out2: '#F0DFA0', style: 'robe', wp: 'staff', wc: '#A07A4A', ext: ['beardLong'], beard: '#F7F7F7' });

  /* ---------- 野怪 / 暗影 ---------- */
  G.MONSTERS = {
    minion: { name: '暗影近战兵', hp: 420, ad: 38, as: 0.7, range: 1, armor: 15, mr: 10, kind: 'chibi',
      look: { skin: '#9C8FB8', hair: '#2B1E3F', hs: 'short', out: '#3C2A5A', out2: '#7B5BB0', style: 'armor', wp: 'sword', wc: '#8C7FB0', hat: 'helmet', hatc: '#4A3570', eye: '#FF4D5D' } },
    caster: { name: '暗影法师兵', hp: 320, ad: 34, as: 0.65, range: 3, armor: 10, mr: 15, kind: 'chibi',
      look: { skin: '#9C8FB8', hair: '#2B1E3F', hs: 'short', out: '#4A2F6A', out2: '#B07BE0', style: 'robe', wp: 'orb', wc: '#C07CFF', hat: 'hood', hatc: '#3A2856', eye: '#FF4D5D' } },
    cannon: { name: '暗影炮车', hp: 800, ad: 60, as: 0.5, range: 3, armor: 30, mr: 20, kind: 'cannon' },
    golem: { name: '魔像·蓝', hp: 1300, ad: 70, as: 0.55, range: 1, armor: 40, mr: 30, kind: 'golem', color: '#3E7FD6' },
    golemR: { name: '魔像·红', hp: 1300, ad: 85, as: 0.55, range: 1, armor: 30, mr: 30, kind: 'golem', color: '#D6543E' },
    tyrant: { name: '暴君', hp: 3600, ad: 120, as: 0.6, range: 1, armor: 45, mr: 40, kind: 'dragon', boss: 1, color: '#7A3FA0', color2: '#E07AF0', size: 1.12, skill: 'tyrant' },
    overlord: { name: '主宰', hp: 7000, ad: 170, as: 0.6, range: 1, armor: 60, mr: 60, kind: 'dragon', boss: 1, color: '#3A2F55', color2: '#FF8A3A', size: 1.22, skill: 'overlord' },
    storm: { name: '风暴龙王', hp: 12000, ad: 230, as: 0.65, range: 2, armor: 70, mr: 70, kind: 'dragon', boss: 2, color: '#2E6FB7', color2: '#FFD65A', size: 1.34, skill: 'storm' },
    dragonling: { name: '风暴幼龙', hp: 900, ad: 80, as: 0.7, range: 2, armor: 30, mr: 30, kind: 'dragon', color: '#3F86D0', color2: '#9FE3FF', size: 0.62 }
  };

  /* ---------- 装备 ---------- */
  G.COMPONENTS = ['sword', 'dagger', 'tome', 'armor', 'cloak', 'ruby', 'sapphire'];
  G.ITEMS = {
    sword: { name: '铁剑', s: { ad: 15 }, desc: '+15 攻击力', c: '#D8DEE6', comp: 1 },
    dagger: { name: '匕首', s: { as: 12 }, desc: '+12% 攻击速度', c: '#9EE0A8', comp: 1 },
    tome: { name: '咒术典籍', s: { ap: 15 }, desc: '+15 法术强度', c: '#B89CFF', comp: 1 },
    armor: { name: '布甲', s: { armor: 20 }, desc: '+20 护甲', c: '#D9B27A', comp: 1 },
    cloak: { name: '抗魔披风', s: { mr: 20 }, desc: '+20 魔抗', c: '#7FB8F0', comp: 1 },
    ruby: { name: '红玛瑙', s: { hp: 180 }, desc: '+180 生命', c: '#F06A6A', comp: 1 },
    sapphire: { name: '蓝宝石', s: { mana: 15 }, desc: '+15 初始法力', c: '#5AA0FF', comp: 1 }
  };
  const C = (a, b, id, name, desc, extra) => {
    G.ITEMS[id] = Object.assign({ name, desc, from: [a, b], c: null }, extra || {});
  };
  C('sword', 'sword', 'wujin', '无尽战刃', '暴击率 +20%，暴击伤害 +50%。', { s: { crit: 20, critd: 50 } });
  C('sword', 'dagger', 'shandian', '闪电匕首', '每第 3 次普攻释放闪电，对 3 名敌人造成 70 魔法伤害。');
  C('sword', 'tome', 'anying', '暗影战斧', '技能可以暴击，暴击率 +10%。', { s: { crit: 10 } });
  C('sword', 'armor', 'mingdao', '名刀·司命', '首次受到致命伤害时免死，并在 1.5 秒内无敌。');
  C('sword', 'cloak', 'pomo', '破魔刀', '受到的魔法伤害降低 15%，攻击力 +10。', { s: { ad: 10 } });
  C('sword', 'ruby', 'qixue', '泣血之刃', '获得 25% 物理吸血。');
  C('sword', 'sapphire', 'moshi', '末世', '普攻附加目标当前生命 5% 的物理伤害。');
  C('dagger', 'dagger', 'zhuri', '逐日之弓', '攻速 +20%，射程 +1。', { s: { as: 20 } });
  C('dagger', 'tome', 'wushu', '巫术法杖', '每次普攻 +4 法术强度，可叠加。');
  C('dagger', 'armor', 'fanshang', '反伤刺甲', '受到普攻时反弹 25% 伤害。');
  C('dagger', 'cloak', 'yingren', '影刃', '暴击后 2 秒内攻速 +25%。', { s: { crit: 10 } });
  C('dagger', 'ruby', 'zongshi', '宗师之力', '施放技能后，下次普攻额外造成 200% 攻击力的物理伤害。');
  C('dagger', 'sapphire', 'suixing', '碎星锤', '普攻使目标护甲 -30%，持续 4 秒。');
  C('tome', 'tome', 'boxue', '博学者之怒', '法术强度额外 +35。', { s: { ap: 35 } });
  C('tome', 'armor', 'huiyue', '辉月', '首次生命低于 40% 时，无敌 2 秒。');
  C('tome', 'cloak', 'tongku', '痛苦面具', '技能额外造成目标当前生命 6% 的魔法伤害。');
  C('tome', 'ruby', 'shishen', '噬神之书', '获得 25% 法术吸血。');
  C('tome', 'sapphire', 'huixiang', '回响之杖', '技能命中后在目标处爆炸，对周围 1 格造成 150 魔法伤害。');
  C('armor', 'armor', 'bazhe', '霸者重装', '每秒回复 2% 最大生命。');
  C('armor', 'cloak', 'buxiang', '不祥征兆', '攻击你的敌人攻速 -25%，持续 3 秒。');
  C('armor', 'ruby', 'honglian', '红莲斗篷', '每 2 秒对周围 1 格敌人造成 5% 最大生命的魔法伤害。');
  C('armor', 'sapphire', 'jihan', '极寒风暴', '开战时使周围 2 格敌人攻速 -30%，持续 6 秒。');
  C('cloak', 'cloak', 'monv', '魔女斗篷', '开战时获得 450 护盾。');
  C('cloak', 'ruby', 'xuemo', '血魔之怒', '生命低于 40% 时获得 40% 最大生命护盾。');
  C('cloak', 'sapphire', 'xianzhe', '贤者的庇护', '首次阵亡时复活并回复 40% 生命。');
  C('ruby', 'ruby', 'jinwei', '近卫荣耀', '开战时为相邻友军与自己提供 250 护盾。');
  C('ruby', 'sapphire', 'jiushu', '救赎之翼', '施放技能时为周围 2 格友军回复 150 生命。');
  C('sapphire', 'sapphire', 'shengbei', '圣杯', '每 3 秒回复 10 法力。');
  G.COMBO = {};
  for (const id in G.ITEMS) {
    const it = G.ITEMS[id]; it.id = id;
    if (it.from) {
      const [a, b] = it.from;
      G.COMBO[a + '+' + b] = id; G.COMBO[b + '+' + a] = id;
      it.s = Object.assign({}, it.s || {});
      for (const k of [a, b]) for (const sk in G.ITEMS[k].s) it.s[sk] = (it.s[sk] || 0) + G.ITEMS[k].s[sk];
      it.c = G.ITEMS[a].c; it.c2 = G.ITEMS[b].c;
    }
  }
  G.FULL_ITEMS = Object.keys(G.ITEMS).filter(k => !G.ITEMS[k].comp);
  G.STAT_NAMES = { hp: '生命', ad: '攻击', as: '攻速%', ap: '法强', armor: '护甲', mr: '魔抗', mana: '法力', crit: '暴击%', critd: '暴伤%' };

  /* ---------- 奇遇（海克斯式强化） ---------- */
  // tier: 1 白银 2 黄金 3 棱彩
  G.AUGMENTS = [
    { id: 'rich', tier: 1, name: '富甲一方', glyph: '金', desc: '立即获得 10 金币。' },
    { id: 'salary', tier: 1, name: '俸禄', glyph: '禄', desc: '每回合额外获得 2 金币。' },
    { id: 'freeroll', tier: 1, name: '免费刷新', glyph: '刷', desc: '每回合开始时获得 1 次免费刷新。' },
    { id: 'xp', tier: 1, name: '勤学苦练', glyph: '学', desc: '立即获得 6 经验，之后每回合额外 +1 经验。' },
    { id: 'items2', tier: 1, name: '装备商人', glyph: '商', desc: '获得 2 件随机基础装备。' },
    { id: 'power', tier: 1, name: '峡谷之力', glyph: '力', desc: '全体英雄 +12% 攻击力，+12 法术强度。' },
    { id: 'vital', tier: 1, name: '生命之泉', glyph: '泉', desc: '全体英雄 +180 最大生命。' },
    { id: 'haste', tier: 1, name: '快马加鞭', glyph: '疾', desc: '全体英雄 +15% 攻击速度。' },
    { id: 'crit', tier: 1, name: '致命节奏', glyph: '暴', desc: '全体英雄 +15% 暴击率。' },
    { id: 'thorns', tier: 1, name: '铜墙铁壁', glyph: '甲', desc: '全体英雄 +25 护甲与魔抗。' },
    { id: 'dragoneye', tier: 1, name: '龙王之眼', glyph: '龙', desc: '野怪回合的战利品翻倍。' },
    { id: 'bigrich', tier: 2, name: '天降横财', glyph: '财', desc: '立即获得 22 金币。' },
    { id: 'interest', tier: 2, name: '利滚利', glyph: '息', desc: '利息上限提高到 8 金币。' },
    { id: 'recruit3', tier: 2, name: '招贤纳士', glyph: '贤', desc: '获得 2 个随机三费英雄。' },
    { id: 'itemFull', tier: 2, name: '神兵天降', glyph: '兵', desc: '获得 1 件随机成品装备。' },
    { id: 'mana', tier: 2, name: '先发制人', glyph: '先', desc: '全体英雄开场法力 +20。' },
    { id: 'shieldAll', tier: 2, name: '众志成城', glyph: '盾', desc: '开战时全队获得 300 护盾，持续 8 秒。' },
    { id: 'regen', tier: 2, name: '生生不息', glyph: '生', desc: '全体英雄每秒回复 1.5% 最大生命。' },
    { id: 'vamp', tier: 2, name: '饮血', glyph: '血', desc: '全体英雄获得 15% 全能吸血。' },
    { id: 'lastStand', tier: 2, name: '背水一战', glyph: '背', desc: '你每损失 10 点生命，全体英雄伤害 +3%。' },
    { id: 'execute', tier: 2, name: '斩杀', glyph: '斩', desc: '对生命值低于 12% 的敌人造成伤害时直接将其斩杀。' },
    { id: 'emb_warrior', tier: 2, name: '战士之魂', glyph: '战', desc: '你的「战士」羁绊人数 +1。', emb: 'warrior' },
    { id: 'emb_mage', tier: 2, name: '法师之魂', glyph: '法', desc: '你的「法师」羁绊人数 +1。', emb: 'mage' },
    { id: 'emb_hunter', tier: 2, name: '猎人之魂', glyph: '猎', desc: '你的「猎人」羁绊人数 +1。', emb: 'hunter' },
    { id: 'emb_assassin', tier: 2, name: '刺客之魂', glyph: '刺', desc: '你的「刺客」羁绊人数 +1。', emb: 'assassin' },
    { id: 'emb_support', tier: 2, name: '辅助之魂', glyph: '辅', desc: '你的「辅助」羁绊人数 +1。', emb: 'support' },
    { id: 'recruit4', tier: 3, name: '良将来投', glyph: '将', desc: '获得 1 个随机四费英雄（2 星）。' },
    { id: 'itemBox', tier: 3, name: '王者宝库', glyph: '宝', desc: '获得 2 件随机成品装备。' },
    { id: 'starup', tier: 3, name: '升星秘术', glyph: '星', desc: '场上随机一个 1 星英雄升为 2 星。' },
    { id: 'kingpower', tier: 3, name: '王者降临', glyph: '王', desc: '全体英雄 +25% 攻击力、+25 法术强度、+15% 攻速。' }
  ];
  G.AUG_TIER_NAMES = ['', '白银', '黄金', '棱彩'];
  G.AUG_TIER_COLORS = ['', '#C9D3DE', '#F2C14E', '#E98BFF'];

  /* ---------- 峡谷奇遇（随机事件） ---------- */
  G.EVENTS = [
    { id: 'merchant', name: '神秘商人', glyph: '商', text: '一位裹着斗篷的商人在河道边摆开货摊，货物闪着微光。',
      opts: [{ t: '花 4 金币购买基础装备', cost: 4, fx: 'comp' }, { t: '花 9 金币购买成品装备', cost: 9, fx: 'full' }, { t: '离开', fx: 'none' }] },
    { id: 'gamble', name: '峡谷赌坊', glyph: '赌', text: '骰盅声声，庄家笑眯眯地看着你：「押大还是押小？」',
      opts: [{ t: '押 5 金币（50% 赢 12 金币）', cost: 5, fx: 'bet1' }, { t: '押 10 金币（40% 赢 28 金币）', cost: 10, fx: 'bet2' }, { t: '转身离开', fx: 'none' }] },
    { id: 'wander', name: '流浪剑客', glyph: '侠', text: '一名风尘仆仆的剑客拦住去路，想要投奔你的麾下。',
      opts: [{ t: '收入麾下（随机英雄）', fx: 'hero' }, { t: '赠他盘缠换 3 金币的情报', fx: 'gold3' }] },
    { id: 'spring', name: '泉水祝福', glyph: '泉', text: '你来到一汪清泉旁，泉水闪着温柔的光。',
      opts: [{ t: '饮下泉水：回复 10 生命', fx: 'heal10' }, { t: '收集泉水出售：获得 5 金币', fx: 'gold5' }] },
    { id: 'relic', name: '龙王遗骸', glyph: '骸', text: '风暴龙王的遗骸中，一件神兵闪着寒光，但暗影之力缠绕其上。',
      opts: [{ t: '失去 8 生命，夺取成品装备', fx: 'relic' }, { t: '不去冒险', fx: 'none' }] },
    { id: 'lecture', name: '稷下讲学', glyph: '学', text: '稷下学院的先生正在讲学，旁听者络绎不绝。',
      opts: [{ t: '认真听讲：获得 8 经验', fx: 'xp8' }, { t: '摆摊卖茶：获得 4 金币', fx: 'gold4' }] },
    { id: 'chest', name: '天降宝箱', glyph: '箱', text: '一只镶金宝箱从天而降，落在你的棋盘边。',
      opts: [{ t: '打开宝箱', fx: 'chest' }] },
    { id: 'pact', name: '暗影契约', glyph: '契', text: '暗影中传来低语：「以血为契，赐你财富。」',
      opts: [{ t: '签下契约：失去 10 生命，获得 15 金币', fx: 'pact' }, { t: '拒绝诱惑', fx: 'none' }] }
  ];

  /* ---------- 召唤师 ---------- */
  G.BOT_NAMES = ['长安夜行人', '稷下小书童', '峡谷之巅', '打野不带惩戒', '五排来个辅助', '国服第一后羿', '别抢我兵线', '云中漫步', '河道蟹保护协会', '一血在我', '暴君已刷新', '偷塔专业户'];
  G.BOT_STYLES = [
    { traits: ['hunter', 'shenhua'], name: '猎神流' }, { traits: ['mage', 'jixia'], name: '稷下法师' },
    { traits: ['assassin', 'changan'], name: '长安刺客' }, { traits: ['warrior', 'changcheng'], name: '长城铁卫' },
    { traits: ['sanfen', 'warrior'], name: '三分群雄' }, { traits: ['chuhan', 'assassin'], name: '楚汉争霸' },
    { traits: ['mage', 'sanfen'], name: '三分法' }, { traits: ['support', 'mage'], name: '辅助法' },
    { traits: ['hunter', 'changan'], name: '长安神射' }
  ];

  G.STAGE_DMG = [0, 0, 2, 5, 8, 10, 12, 15, 17, 20];
})(window.G);
