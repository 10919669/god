/**
 * result-experience.js
 * 结果内容增强层：稳定 ID、社交分享文案、第一性原理解释、裂变链接
 */

const FAMILY_ALIASES = {
  eat_today: 'eat_today',
  drink_today: 'drink_today',
  wear_today: 'wear_today',
  wash_hair: 'wash_hair',
  sleep_early: 'sleep_early',
  go_out: 'go_out',
  send_msg: 'send_msg',
  send_message: 'send_msg',
  buy_it: 'buy_it',
  date: 'date',
  fitness: 'fitness',
  study: 'study',
  diet: 'diet',
  custom: 'custom',
};

const FAMILY_COPY = {
  eat_today: {
    label: '吃饭判断',
    A: {
      subhead: ['今天更适合被热量接住。', '你现在需要的是一顿明确的满足感。'],
      principle: ['当前最重要的不是吃得高级，而是用最小决策成本把能量补回来。', '你现在的注意力和体力都在下降，先把吃饱这件事解决，后面的事才会顺。'],
      comfort: ['别再为一顿饭消耗自己了，被照顾一下不丢人。', '你不是嘴馋，你只是已经太久没好好对自己了。'],
      share: ['发给那个永远说“都行”的饭搭子，让他这次别装随意。', '转发给今天也在纠结午饭的人，这张图比群投票更有效。'],
      scenes: ['warm-noodle', 'night-kitchen', 'steam-table', 'city-diner'],
    },
    wait: {
      subhead: ['今天更适合轻一点，不适合再给身体加负担。'],
      principle: ['现在的问题不是吃什么最爽，而是吃完之后你会不会更沉、更累、更后悔。'],
      comfort: ['少一点负担，不代表亏待自己。', '你可以先照顾身体，再考虑情绪。'],
      share: ['发给那个总说“最后再吃一次”的朋友。'],
      scenes: ['clear-bowl', 'soft-lunch', 'tea-window'],
    },
    B: {
      subhead: ['今天不适合放纵，适合及时刹车。'],
      principle: ['继续顺着冲动吃，只会把短暂快乐换成更长的内耗。'],
      comfort: ['忍住不是委屈自己，是给明天留体力。', '今天收一收，不会让你失去快乐，只会让你更稳。'],
      share: ['发给那个嘴上减脂、手上点外卖的人。'],
      scenes: ['cool-fridge', 'midnight-table', 'empty-delivery'],
    },
  },
  drink_today: {
    label: '饮品判断',
    A: {
      subhead: ['你现在需要的不是犹豫，是一杯能把状态拉回来的东西。'],
      principle: ['饮品的价值不在于好不好拍，而在于它能不能立刻修复你的精神电量。'],
      comfort: ['有时候被一杯东西接住，也是一种恢复。', '别把每次小满足都叫放纵。'],
      share: ['发给那个靠奶茶和咖啡续命的人，他会秒懂。'],
      scenes: ['glass-rain', 'cafe-light', 'neon-cup'],
    },
    wait: {
      subhead: ['今天更适合克制一点，不必靠刺激感提神。'],
      principle: ['如果你已经靠糖和咖啡硬撑太久，继续加码不会让状态真正变好。'],
      comfort: ['慢一点，不等于今天就输了。', '给身体留一点余地，明天会感谢你。'],
      share: ['发给那个每天三杯还说自己没事的人。'],
      scenes: ['tea-steam', 'quiet-counter', 'plain-glass'],
    },
    B: {
      subhead: ['今天不需要再补刺激，需要先收一收。'],
      principle: ['继续依赖提神，只会把疲惫往后推，不会让疲惫消失。'],
      comfort: ['你不是不努力，你只是已经有点透支。', '先停一下，比再灌一杯更有效。'],
      share: ['发给那个又想点第三杯的人。'],
      scenes: ['empty-cup', 'late-desk', 'dim-cafe'],
    },
  },
  wear_today: {
    label: '穿搭判断',
    A: {
      subhead: ['今天穿搭的核心不是惊艳，是让你出门时不自我怀疑。'],
      principle: ['最优穿搭不是最复杂的那套，而是最符合场景、温度和你当前状态的那套。'],
      comfort: ['穿对一点，很多情绪会自己稳下来。', '你不用证明自己，只需要今天过得顺一点。'],
      share: ['发给那个每天都问“我今天穿什么”的朋友。'],
      scenes: ['mirror-room', 'fabric-light', 'closet-soft'],
    },
    wait: {
      subhead: ['今天适合稳一点，不适合穿得太用力。'],
      principle: ['你今天需要的是低摩擦出门，不是再给选择这件事增加成本。'],
      comfort: ['舒服不是没审美，是今天最实用的审美。', '别因为一套衣服，把心情先穿皱了。'],
      share: ['发给那个每次出门都换三轮的人。'],
      scenes: ['folded-shirt', 'chair-light', 'soft-hanger'],
    },
    B: {
      subhead: ['今天不适合硬凹风格，适合先让自己轻松一点。'],
      principle: ['当你的注意力本来就紧张时，复杂穿搭只会继续消耗你。'],
      comfort: ['松一点，不代表敷衍。', '今天先舒服，明天再漂亮。'],
      share: ['发给那个明明迟到了还在选衣服的人。'],
      scenes: ['quiet-wardrobe', 'dark-mirror', 'bedside-look'],
    },
  },
  wash_hair: {
    label: '状态判断',
    A: {
      subhead: ['今天更适合清一下状态，而不只是清一下头发。'],
      principle: ['当外在已经开始影响你对自己的感受时，最小成本的重启就是立刻整理自己。'],
      comfort: ['不是矫情，是你确实值得清爽一点。', '有时候重新开机，就从洗个头开始。'],
      share: ['发给那个总说“明天再洗”的朋友。'],
      scenes: ['bath-light', 'mirror-drop', 'clean-breeze'],
    },
    wait: {
      subhead: ['今天可以不折腾，但别把拖延包装成随意。'],
      principle: ['如果你今天没有见人和出门压力，暂时不处理也不会造成额外代价。'],
      comfort: ['省一点力气，也是一种照顾自己。', '今天不想动，并不代表你失败。'],
      share: ['发给那个每次都在洗与不洗之间挣扎的人。'],
      scenes: ['mist-room', 'quiet-towel', 'night-bath'],
    },
    B: {
      subhead: ['今天不处理，明天大概率会更烦。'],
      principle: ['当一个小问题会滚成更大的社交负担时，拖延本身就是额外成本。'],
      comfort: ['你不需要完美，但可以给自己一点体面。', '早点处理掉，后面会轻松很多。'],
      share: ['发给那个靠帽子硬撑的人。'],
      scenes: ['wet-window', 'sink-light', 'morning-mirror'],
    },
  },
  sleep_early: {
    label: '节奏判断',
    A: {
      subhead: ['今天最优选择不是再撑一下，是把明天的自己保下来。'],
      principle: ['继续熬夜也许能多换一点当下自由，但会直接透支明天的判断力和情绪稳定。'],
      comfort: ['早点睡不是认输，是你终于站在自己这边。', '你已经够累了，不必再向夜晚证明什么。'],
      share: ['发给那个总说“再刷五分钟”的朋友。'],
      scenes: ['moon-desk', 'window-night', 'lamp-blue'],
    },
    wait: {
      subhead: ['今天可以晚一点，但要有边界。'],
      principle: ['问题不在于你想不想继续醒着，而在于你有没有给今晚设定收口时间。'],
      comfort: ['放松一下可以，但别让放松变成失控。', '你可以慢一点，不必彻底散掉。'],
      share: ['发给那个自律到一半就开始摆的人。'],
      scenes: ['clock-light', 'bed-shadow', 'city-night'],
    },
    B: {
      subhead: ['今天不适合继续熬，继续熬只会把明天一起赔进去。'],
      principle: ['如果明天还有任务，今晚每多熬一小时，都是在提前消耗明天的状态。'],
      comfort: ['早点结束今天，不代表今天过得不够好。', '你可以把今天停在一个还不错的位置。'],
      share: ['发给那个凌晨还在线的人。'],
      scenes: ['dark-room', 'phone-glow', 'sleep-mode'],
    },
  },
  go_out: {
    label: '出门判断',
    A: {
      subhead: ['今天更适合离开房间，去接触真实的人和事。'],
      principle: ['当情绪已经在室内循环过久，换场景往往比继续想更能改变状态。'],
      comfort: ['不是逼你社交，只是别让自己困在原地。', '出去一下，也许不会解决所有问题，但会打断内耗。'],
      share: ['发给那个已经宅太久的人。'],
      scenes: ['street-light', 'station-wind', 'door-open'],
    },
    wait: {
      subhead: ['今天不是不能出门，是没必要为了证明自己状态好而硬出门。'],
      principle: ['如果出门的收益不高、准备成本却很高，留在更舒服的环境里反而更优。'],
      comfort: ['宅着不丢人，盲目出门才更消耗。', '把自己留在舒服的地方，也是一种策略。'],
      share: ['发给那个嘴上说想出门、实际不想动的人。'],
      scenes: ['window-seat', 'home-rain', 'quiet-sofa'],
    },
    B: {
      subhead: ['今天更适合宅着，把能量收回来。'],
      principle: ['在状态低、社交回报低的时候勉强出门，通常只会扩大疲惫感。'],
      comfort: ['待在家里不是输，是你知道什么时候该收。', '今天先保住自己，明天再去面对世界。'],
      share: ['发给那个总被人叫出去但其实很累的人。'],
      scenes: ['rain-window', 'bench-rose', 'room-lamp'],
    },
  },
  send_msg: {
    label: '沟通判断',
    A: {
      subhead: ['今天更适合把话说出去，而不是继续在脑子里模拟。'],
      principle: ['你现在承担的最大成本，不是发错，而是因为迟疑错过最佳沟通窗口。'],
      comfort: ['勇敢一点，不等于失去体面。', '把球踢出去，至少今晚不会再反复想。'],
      share: ['发给那个在聊天框删改三次的人。', '发给那个嘴硬但其实很想联系的人。'],
      scenes: ['chat-night', 'phone-glow', 'signal-window'],
    },
    wait: {
      subhead: ['今天可以想，但不适合立刻按发送。'],
      principle: ['当你还没想清楚自己真正想得到什么回应时，发出去只会让后续更被动。'],
      comfort: ['等一下不是退缩，是让自己少一点后悔。', '把话先放一会儿，也是在保护自己。'],
      share: ['发给那个每次都秒发、然后后悔的人。'],
      scenes: ['typing-room', 'late-message', 'blue-phone'],
    },
    B: {
      subhead: ['今天不适合发，沉默比硬聊更稳。'],
      principle: ['如果对方当前没有明确接球迹象，你现在的主动更像情绪释放，而不是有效沟通。'],
      comfort: ['先不发，不代表你不重要。', '把体面留住，有时候比把话说尽更值钱。'],
      share: ['发给那个想联系前任/暧昧对象的人。'],
      scenes: ['unsent-text', 'dark-chat', 'quiet-phone'],
    },
  },
  buy_it: {
    label: '消费判断',
    A: {
      subhead: ['今天可以买，但前提是它真的在解决你的问题。'],
      principle: ['值得买的核心不是“想要”，而是这笔钱能不能换来明确收益、使用频率或情绪修复。'],
      comfort: ['为自己花钱没问题，关键是别替冲动付太多学费。', '如果它真能改善你今天，那这笔钱不算白花。'],
      share: ['发给那个每次下单前都想让人背书的人。'],
      scenes: ['shopping-bag', 'receipt-light', 'store-night'],
    },
    wait: {
      subhead: ['今天更适合先等等，让欲望过一轮冷却。'],
      principle: ['当一个决定只靠情绪驱动时，给自己一个观察期，通常能省掉很多无意义支出。'],
      comfort: ['缓一缓，不代表你配不上。', '晚一点买，往往会更清楚自己到底需不需要。'],
      share: ['发给那个收藏夹比工资单还长的人。'],
      scenes: ['wishlist', 'cart-delay', 'soft-checkout'],
    },
    B: {
      subhead: ['今天不值得买，冲动的快乐撑不了太久。'],
      principle: ['如果使用场景不明确、替代品很多、回报又短，那这笔钱的机会成本就偏高。'],
      comfort: ['不买不是委屈自己，是把钱留给更值得的东西。', '你不是不配拥有，只是今天它还不够值。'],
      share: ['发给那个总说“最后一单”的朋友。'],
      scenes: ['closed-cart', 'empty-wallet', 'late-store'],
    },
  },
  date: {
    label: '关系判断',
    A: {
      subhead: ['今天更适合推进一点关系，而不是继续隔空猜。'],
      principle: ['关系里最贵的不是被拒绝，而是双方都迟迟不动，最后把窗口期耗没。'],
      comfort: ['你不需要表现得完美，只需要比昨天更真诚一点。', '主动一下，不代表你输，只代表你愿意面对答案。'],
      share: ['发给那个正在暧昧里原地打转的人。'],
      scenes: ['rose-window', 'rain-date', 'bench-light'],
    },
    wait: {
      subhead: ['今天可以靠近一点，但别急着要答案。'],
      principle: ['当对方反馈还不稳定时，先保留空间，比一下子用力过猛更有效。'],
      comfort: ['慢一点，不代表没戏。', '有些关系是靠节奏感，而不是靠冲劲。'],
      share: ['发给那个一上头就想摊牌的人。'],
      scenes: ['soft-rose', 'city-rain', 'window-heart'],
    },
    B: {
      subhead: ['今天不适合推进，先把自己的状态放回第一位。'],
      principle: ['如果现在推进只会放大失衡感，那暂停比硬冲更能保住长期可能性。'],
      comfort: ['不是你不够好，只是今天不是最合适的窗口。', '把自己稳住，比马上得到回应更重要。'],
      share: ['发给那个总在感情里替别人找借口的人。'],
      scenes: ['night-bench', 'quiet-rose', 'lamp-window'],
    },
  },
  fitness: {
    label: '行动判断',
    A: {
      subhead: ['今天更适合动起来，让身体带你把状态拉回去。'],
      principle: ['当注意力涣散、情绪发闷时，运动是最直接的状态重启手段之一。'],
      comfort: ['不是逼自己，是给自己一个重新清醒的机会。', '哪怕只完成一半，也比一直想着强。'],
      share: ['发给那个说健身三天、停了两周的人。'],
      scenes: ['track-light', 'gym-shadow', 'sun-run'],
    },
    wait: {
      subhead: ['今天可以动，但别用过量来证明自己。'],
      principle: ['如果恢复不足、注意力一般，轻量输出比硬撑高强度更能形成正反馈。'],
      comfort: ['少一点，不代表白做。', '今天对自己温柔一点，反而更容易坚持。'],
      share: ['发给那个一运动就想练到废的人。'],
      scenes: ['stretch-room', 'water-break', 'morning-gym'],
    },
    B: {
      subhead: ['今天不适合硬练，恢复比表现更重要。'],
      principle: ['当身体信号已经偏疲惫时，继续硬撑只会把恢复周期拉得更长。'],
      comfort: ['休息不是摆烂，是训练的一部分。', '今天先把自己养回来，明天再发力。'],
      share: ['发给那个把休息当罪恶感的人。'],
      scenes: ['rest-bench', 'dim-track', 'cool-down'],
    },
  },
  study: {
    label: '学习判断',
    A: {
      subhead: ['今天更适合深一点的输入，脑子是开着的。'],
      principle: ['当专注窗口已经出现时，最优策略不是继续纠结学什么，而是立刻进入任务。'],
      comfort: ['你不需要先有完美状态，开始本身就会制造状态。', '今天愿意坐下来，就已经赢过昨天了。'],
      share: ['发给那个一直想学但迟迟没开学的人。'],
      scenes: ['desk-lamp', 'library-blue', 'book-window'],
    },
    wait: {
      subhead: ['今天可以学，但更适合稳一点、短一点。'],
      principle: ['当心智资源不满格时，缩短目标和降低难度，比硬上高强度更能保住节奏。'],
      comfort: ['今天学一点，也比什么都不学强。', '别把轻量学习误解成自己不行。'],
      share: ['发给那个总被学习计划吓退的人。'],
      scenes: ['note-light', 'soft-desk', 'afternoon-book'],
    },
    B: {
      subhead: ['今天不适合硬啃，先把状态捋顺更重要。'],
      principle: ['如果你已经明显心浮气躁，继续坐着只会制造“学了却没进”的挫败感。'],
      comfort: ['暂停一下不是懒，是为了别把自己学崩。', '今天先恢复专注能力，比堆时长更值。'],
      share: ['发给那个坐了三小时却一句没看进去的人。'],
      scenes: ['night-desk', 'messy-note', 'rain-study'],
    },
  },
  diet: {
    label: '节制判断',
    A: {
      subhead: ['今天更适合稳住，不要让短期食欲牵着你走。'],
      principle: ['如果你的长期目标是控制体重和状态，那今天最优解一定是先守住总量。'],
      comfort: ['克制不是亏待自己，是你开始替未来负责。', '今天收一点，明天会轻很多。'],
      share: ['发给那个总在减脂和点单之间横跳的人。'],
      scenes: ['green-table', 'leaf-light', 'clear-plate'],
    },
    wait: {
      subhead: ['今天可以稍微松一点，但别把情绪全交给食物。'],
      principle: ['如果你已经很累，适度放松可以接受，但最好让它停在“恢复感”而不是“报复性补偿”。'],
      comfort: ['偶尔松一点，不会毁掉全部努力。', '重点不是完美，而是别彻底失控。'],
      share: ['发给那个一说控制饮食就开始焦虑的人。'],
      scenes: ['soft-green', 'fruit-room', 'window-plate'],
    },
    B: {
      subhead: ['今天不适合继续放飞，停下来更值。'],
      principle: ['当你已经开始靠吃来安抚情绪时，再加一轮只会把情绪和内疚一起放大。'],
      comfort: ['停一停，不代表你失败。', '你不是只能靠吃来让自己好受。'],
      share: ['发给那个总说“明天再开始”的朋友。'],
      scenes: ['scale-shadow', 'late-snack', 'cool-kitchen'],
    },
  },
  oracle: {
    label: '重大判断',
    A: {
      subhead: ['这不是简单的对错题，而是当下窗口值不值得抓。'],
      principle: ['重大决定的核心，不是有没有完美答案，而是你有没有足够筹码、时机和承受力。'],
      comfort: ['谨慎不是退缩，是你终于认真对待自己的人生。', '慢一点做决定，不会让你失去命运，只会减少误判。'],
      share: ['发给那个你最信任、能说真话的人。'],
      scenes: ['oracle-ring', 'gold-card', 'deep-sky'],
    },
    wait: {
      subhead: ['现在更像观察窗口，不像落子窗口。'],
      principle: ['当信息还不完整、风险边界又不清晰时，过早出手通常不是勇敢，而是赌博。'],
      comfort: ['等等看，不代表没答案。', '有些决定晚一点，反而更像成熟。'],
      share: ['发给那个能帮你看清局势的人。'],
      scenes: ['slow-orbit', 'moon-gate', 'quiet-cosmos'],
    },
    B: {
      subhead: ['当前不值得强推，代价大于收益。'],
      principle: ['如果你要付出的成本已经明显高过回报预期，那这一步现在就不该走。'],
      comfort: ['撤一步，不代表输。', '先保住基本盘，比逞强更重要。'],
      share: ['发给那个会劝你但不会替你做主的人。'],
      scenes: ['red-gate', 'storm-orbit', 'dark-compass'],
    },
  },
  generic: {
    label: '日常判断',
    A: {
      subhead: ['今天更适合往前走，不适合继续原地模拟。'],
      principle: ['当收益已经比犹豫成本更高时，继续拖只会把简单题拖成情绪题。'],
      comfort: ['你不需要百分百确定，七成把握就值得动。', '把第一步迈出去，很多纠结会自己消失。'],
      share: ['发给那个总在同一件事上打转的人。'],
      scenes: ['soft-light', 'city-glow', 'clear-window'],
    },
    wait: {
      subhead: ['今天适合先稳一下，再做下一步。'],
      principle: ['当信息、精力或情绪都不满格时，过快决定通常不是高效，而是埋雷。'],
      comfort: ['慢一点，不会让你错过全部。', '你可以先收集，再决定。'],
      share: ['发给那个正想仓促做决定的人。'],
      scenes: ['quiet-room', 'gray-window', 'slow-light'],
    },
    B: {
      subhead: ['今天不值得硬冲，先收回来更划算。'],
      principle: ['如果代价已经开始压过收益，最优动作往往不是继续往前，而是先止损。'],
      comfort: ['先停一下，是给自己留余地。', '有时候退一步，才是最清醒的动作。'],
      share: ['发给那个嘴上说无所谓、心里已经很累的人。'],
      scenes: ['night-seat', 'rain-glass', 'dark-lamp'],
    },
  },
};

function hashString(input = '') {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function choose(list, seed, salt = '') {
  if (!Array.isArray(list) || list.length === 0) return '';
  const idx = hashString(`${seed}|${salt}`) % list.length;
  return list[idx];
}

function normalizeDecisionBias(bias) {
  if (bias === 'A' || bias === 'lean_A') return 'A';
  if (bias === 'B' || bias === 'lean_B') return 'B';
  return 'wait';
}

function slugify(text = '') {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function cleanMultiline(text = '') {
  return String(text)
    .replace(/✨[^✨]*✨/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractPrimaryAction(text = '') {
  const cleaned = cleanMultiline(text);
  const parts = cleaned.split(/[。!！?？]/).map(part => part.trim()).filter(Boolean);
  return parts[0] || cleaned;
}

function deriveOracleFallbackFamily(category) {
  if (category === 'relationship' || category === 'social') return 'date';
  if (category === 'fitness' || category === 'study' || category === 'diet') return category;
  if (category === 'work') return 'oracle';
  return 'generic';
}

export function resolveQuestionFamily(templateId, category, questionText = '') {
  if (templateId === 'custom') {
    if (questionText.includes('约会')) return 'date';
    if (questionText.includes('健身')) return 'fitness';
    if (questionText.includes('学习')) return 'study';
    if (questionText.includes('减肥')) return 'diet';
  }
  if (FAMILY_ALIASES[templateId]) return FAMILY_ALIASES[templateId];
  return deriveOracleFallbackFamily(category);
}

export function buildShareUrl(meta = {}) {
  const params = new URLSearchParams();
  params.set('src', 'share');
  if (meta.resultId) params.set('rid', meta.resultId);
  if (meta.questionFamily) params.set('family', meta.questionFamily);
  if (meta.tone) params.set('tone', meta.tone);
  return `https://awkn.cn/god/?${params.toString()}`;
}

export function getFamilyCardSelector(family) {
  const map = {
    eat_today: '.orbit-card[data-tpl="eat_today"]',
    drink_today: '.orbit-card[data-tpl="drink_today"]',
    wear_today: '.orbit-card[data-tpl="wear_today"]',
    wash_hair: '.orbit-card[data-tpl="wash_hair"]',
    sleep_early: '.orbit-card[data-tpl="sleep_early"]',
    go_out: '.orbit-card[data-tpl="go_out"]',
    send_msg: '.orbit-card[data-tpl="send_msg"]',
    buy_it: '.orbit-card[data-tpl="buy_it"]',
    date: '.orbit-card[data-q="去不去约会"]',
    fitness: '.orbit-card[data-q="今天要不要健身"]',
    study: '.orbit-card[data-q="今天要不要学习"]',
    diet: '.orbit-card[data-q="今天要不要减肥"]',
  };
  return map[family] || null;
}

export function enhanceResultContent(result, options = {}) {
  const tone = options.tone || result.tone || (result.seriousnessLevel === 'L3' ? 'oracle' : 'bestie');
  const questionFamily = resolveQuestionFamily(result.templateId, result.category, options.questionText || result.questionText || '');
  const biasGroup = normalizeDecisionBias(result.decisionBias);
  const stableSeed = Number.isFinite(result.variantSeed)
    ? result.variantSeed
    : hashString(`${options.questionText || result.questionText || ''}|${result.templateId}|${result.decisionBias}|${result.confidenceLevel || ''}`);
  const familyConfig = FAMILY_COPY[questionFamily] || FAMILY_COPY.generic;
  const bucket = familyConfig[biasGroup] || FAMILY_COPY.generic[biasGroup];
  const baseHeadline = String(result.resultTitle || '').trim() || '今天先别急';
  const resultId = `${questionFamily}__${biasGroup.toLowerCase()}__${stableSeed % 997}`;
  const posterSceneId = `${questionFamily}__${choose(bucket.scenes || FAMILY_COPY.generic[biasGroup].scenes, stableSeed, 'scene')}__${tone}__${stableSeed % 97}`;
  const actionGuide = extractPrimaryAction(result.resultAction || '');
  const fallbackReason = cleanMultiline(result.resultReason || '');

  return {
    resultId,
    questionFamily,
    tone,
    headline: baseHeadline,
    subhead: choose(bucket.subhead, stableSeed, 'subhead'),
    firstPrinciplesReason: choose(bucket.principle, stableSeed, 'principle') || fallbackReason,
    comfortLine: choose(bucket.comfort, stableSeed, 'comfort'),
    shareHook: choose(bucket.share, stableSeed, 'share'),
    nextStep: actionGuide || '先做更低成本的那一步。',
    posterSceneId,
    posterVariant: 'long',
    reasonLabel: '判断依据',
    actionLabel: '下一步怎么做',
    shareLabel: '这张图适合发给',
    ctaLabel: result.seriousnessLevel === 'L3' ? '测你自己的版本' : '把这张图发给对的人',
    shareUrl: buildShareUrl({ resultId, questionFamily, tone }),
    sceneSeed: hashString(`${posterSceneId}|${baseHeadline}`),
    shortQuestion: FAMILY_COPY[questionFamily]?.label || familyConfig.label || '日常判断',
    cleanedReason: fallbackReason,
    cleanedAction: cleanMultiline(result.resultAction || ''),
  };
}
