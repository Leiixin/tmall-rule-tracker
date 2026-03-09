import dayjs from "dayjs";

function normalizeText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function sortRulesByTime(rules) {
  return [...rules].sort((a, b) => {
    const aTime = dayjs(a.publishedAt || a.lastSeenAt || 0).valueOf();
    const bTime = dayjs(b.publishedAt || b.lastSeenAt || 0).valueOf();
    return bTime - aTime;
  });
}

function pickLatestRule(rules, keywords) {
  return sortRulesByTime(rules).find((rule) => {
    const text = normalizeText(`${rule.title || ""} ${rule.content || ""}`);
    return keywords.some((keyword) => text.includes(keyword));
  });
}

function collectMatchedText(rules, keywords, limit = 12) {
  const matched = [];
  for (const rule of sortRulesByTime(rules)) {
    const text = normalizeText(`${rule.title || ""} ${rule.content || ""}`);
    if (keywords.some((keyword) => text.includes(keyword))) {
      matched.push(text);
      if (matched.length >= limit) {
        break;
      }
    }
  }
  return matched.join(" ");
}

function hasAnyKeyword(rules, keywords) {
  return rules.some((rule) => {
    const text = normalizeText(`${rule.title || ""} ${rule.content || ""}`);
    return keywords.some((keyword) => text.includes(keyword));
  });
}

function extractPenaltyHint(rules, keywords, fallback) {
  const text = collectMatchedText(rules, keywords, 20);
  if (!text) {
    return fallback;
  }

  const percents = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)]
    .map((item) => Number(item[1]))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 50);
  const percent = [...new Set(percents)].sort((a, b) => a - b)[0];

  const moneyValues = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(万)?元/g)]
    .map((item) => {
      const value = Number(item[1]);
      if (!Number.isFinite(value)) {
        return 0;
      }
      return item[2] ? value * 10000 : value;
    })
    .filter((value) => value >= 50 && value <= 200000);

  const moneyLevel = [...new Set(moneyValues)].sort((a, b) => a - b)[0];
  const moneyText = moneyLevel
    ? moneyLevel >= 10000
      ? `${moneyLevel / 10000}万元`
      : `${moneyLevel}元`
    : "";

  if (percent && moneyText) {
    return `通常按订单金额${percent}%赔付，常见单笔上限参考${moneyText}。`;
  }
  if (percent) {
    return `通常按订单金额${percent}%赔付，具体以上线规则为准。`;
  }
  if (moneyText) {
    return `常见固定赔付金额档位可见${moneyText}，并叠加管控处罚。`;
  }
  return fallback;
}

function pickExperienceWindowHint(rules) {
  const text = collectMatchedText(rules, ["体验分", "真实体验分", "有效支付订单", "近30天", "近90天"]);
  if (text.includes("近90天")) {
    return "部分类目按近90天统计，建议按类目单独看口径。";
  }
  if (text.includes("近30天")) {
    return "核心指标多按近30天滚动统计，建议周维度复盘。";
  }
  return "建议按30天滚动窗口做趋势监控与预警。";
}

function pickExperiencePenaltyHint(rules) {
  if (hasAnyKeyword(rules, ["降分", "出售假冒商品", "描述或品质不符", "发布混淆商品"])) {
    return "近期规则强调“违规行为可触发体验分降分”，需与风控联动治理。";
  }
  return "体验分已不是单纯服务分，违规行为也会影响最终分值。";
}

function pickDeliveryStandardHint(rules) {
  const text = collectMatchedText(rules, ["发货", "揽收", "轨迹", "24小时", "48小时", "物流"]);
  if (text.includes("轨迹异常") || text.includes("轨迹超时")) {
    return "平台判定已从“是否上传单号”升级为“轨迹是否连续、是否真实揽收”。";
  }
  return "时效判定核心仍是“承诺时效内发货 + 真实揽收轨迹”。";
}

function pickReplacementHint(rules) {
  if (hasAnyKeyword(rules, ["换货", "补寄", "售后"])) {
    return "换货、补寄场景会单独计入履约时效，建议售后团队单列SLA。";
  }
  return "售后换货需单独跟踪时效，避免与普通发货流程混用。";
}

function pickLatestShippingSource(rules) {
  const timelinessRule = pickLatestRule(rules, ["发货", "揽收", "时效", "物流轨迹", "24小时", "48小时"]);
  const violationRule = pickLatestRule(rules, ["赔付", "违约金", "延迟发货", "虚假发货", "缺货"]);

  const candidates = [timelinessRule, violationRule].filter(Boolean);
  if (!candidates.length) {
    return null;
  }

  return sortRulesByTime(candidates)[0];
}

export function buildSheetPresentation(rules) {
  const experienceRule = pickLatestRule(rules, ["店铺真实体验分", "店铺体验分", "体验分规范"]);
  const shippingSource = pickLatestShippingSource(rules);
  const experienceWindowHint = pickExperienceWindowHint(rules);
  const experiencePenaltyHint = pickExperiencePenaltyHint(rules);
  const deliveryStandardHint = pickDeliveryStandardHint(rules);
  const replacementHint = pickReplacementHint(rules);

  const experienceRows = [
    {
      scoreModel:
        "店铺真实体验分 = 宝贝质量得分×权重 + 物流速度得分×权重 + 服务保障得分×权重 + 附加分（总分不超过5分）",
      dimension: "宝贝质量（35%）",
      metric: "首次品退率（50%）",
      formula: "近30天品质相关退款订单 / 近30天已签收支付订单",
      scoreLogic: "同主营类目分档换算，越低越优。",
      notes: `${experienceWindowHint} 重点先控品质原因退款。`
    },
    {
      scoreModel: "",
      dimension: "宝贝质量（35%）",
      metric: "商品差评率（50%）",
      formula: "近30天商品描述相符1-2星评价次数 / 近30天确认收货订单",
      scoreLogic: "按主营类目档位评分，越低越优。",
      notes: "差评拦截重点在商品信息准确性、预期管理与售前答疑。"
    },
    {
      scoreModel: "",
      dimension: "物流速度（25%）",
      metric: "48小时揽收及时率（50%）",
      formula: "近30天48小时内揽收订单 / 近30天应揽收订单",
      scoreLogic: "按行业档位评分，越高越优。",
      notes: `${deliveryStandardHint} 需监控“有单号无揽收”。`
    },
    {
      scoreModel: "",
      dimension: "物流速度（25%）",
      metric: "物流到货时长（50%）",
      formula: "近30天支付到签收总时长 / 近30天签收订单",
      scoreLogic: "时长越短得分越高。",
      notes: "建议按区域、仓配链路、承运商拆解异常。"
    },
    {
      scoreModel: "",
      dimension: "服务保障（20%）",
      metric: "旺旺3分钟人工响应率（15%）",
      formula: "近30天3分钟内人工响应轮次 / 客服总轮次",
      scoreLogic: "按行业档位评分，越高越优。",
      notes: "高峰期需独立排班，保障人工首响。"
    },
    {
      scoreModel: "",
      dimension: "服务保障（20%）",
      metric: "退款处理时长（20%）",
      formula: "近30天退款处理总时长 / 退款完结笔数",
      scoreLogic: "时长越短得分越高。",
      notes: "按“同意退款-回仓签收-退款完结”拆节点追踪。"
    },
    {
      scoreModel: "",
      dimension: "附加分",
      metric: "当日/次日达占比、特色服务达标占比",
      formula: "附加分在基础维度上叠加，最终总分不超过5分",
      scoreLogic: "附加分提高分值上限，非基础项替代。",
      notes: experiencePenaltyHint
    }
  ];

  const timelinessRows = [
    {
      deliveryTime: "付款后48小时内发货或在承诺时效内发货",
      setup: "默认48小时，可按商品设置24小时发货、预售发货时间",
      standard: "以物流揽收记录（或虚拟商品回传时间）作为判定依据",
      extra: "活动和大促期间按专项公告窗口执行",
      tool: "发货时间设置工具 / 发货协商工具"
    },
    {
      deliveryTime: "节假日、大促等特殊时段",
      setup: "按平台公告的发货窗口和最晚发货时间配置",
      standard: "窗口内按公告口径判定，窗口外按常规规则判定",
      extra: "活动规则优先于日常规则",
      tool: "活动规则中心 / 商家后台公告"
    },
    {
      deliveryTime: "售后换货、补寄场景",
      setup: "商家收到退回商品后需在规则时限内补发/换发",
      standard: "超时触发延迟换货、违背承诺等判定",
      extra: "双方另有协商时按协商约定执行",
      tool: "售后协商工具"
    }
  ];

  const violationRows = [
    {
      type: "延迟发货",
      scene: "未在承诺时效内完成发货或未形成有效揽收",
      penalty: extractPenaltyHint(
        rules,
        ["延迟发货", "赔付", "违约金", "订单金额", "%"],
        "通常按订单金额比例赔付，并有单笔上限与下限。"
      )
    },
    {
      type: "缺货",
      scene: "延迟后仍未发货，或明确无法履约、要求额外加价发货",
      penalty: extractPenaltyHint(
        rules,
        ["缺货", "无法发货", "赔付", "违约金"],
        "投诉成立后按规则赔付，严重场景会叠加经营管控。"
      )
    },
    {
      type: "虚假发货",
      scene: "上传单号后长期无揽收、空包裹、轨迹异常或重复物流信息",
      penalty: extractPenaltyHint(
        rules,
        ["虚假发货", "空包裹", "轨迹异常", "赔付"],
        "赔付比例通常高于延迟发货，并可能叠加扣分/限制。"
      )
    },
    {
      type: "物流轨迹超时/异常",
      scene: "揽收后轨迹长期不更新、停滞或轨迹与地址明显不符",
      penalty: extractPenaltyHint(
        rules,
        ["轨迹超时", "轨迹异常", "停滞", "赔付"],
        "按比例赔付并可能叠加其他处罚。"
      )
    },
    {
      type: "拒绝换货/延迟换货",
      scene: "达成换货协议后，未在时限内发出换货商品",
      penalty: extractPenaltyHint(
        rules,
        ["拒绝换货", "延迟换货", "赔付", "违约金"],
        "按规则比例赔付，并可能设置单日赔付上限。"
      )
    },
    {
      type: "违背补寄承诺",
      scene: "承诺补寄后超时未履约或拒绝履约",
      penalty: extractPenaltyHint(
        rules,
        ["补寄承诺", "违背承诺", "赔付", "违约金"],
        "按规则比例赔付，并可能触发附加经营限制。"
      )
    }
  ];

  return {
    updatedAt: new Date().toISOString(),
    experience: {
      title: "天猫体验分",
      sourceRule: experienceRule?.title || "店铺体验分相关规则",
      sourcePublishedAt: experienceRule?.publishedAt || "-",
      columns: [
        "综合体验分",
        "评分维度及权重",
        "细分指标",
        "公式",
        "指标得分逻辑",
        "考核指标详细说明"
      ],
      rows: experienceRows
    },
    shipping: {
      title: "天猫发货&赔付",
      sourceRule: shippingSource?.title || "发货履约与赔付相关规则",
      sourcePublishedAt: shippingSource?.publishedAt || "-",
      timelinessColumns: ["发货时间", "设置", "发货时间认定标准", "其他", "工具"],
      timelinessRows,
      violationColumns: ["违规类型", "认定场景", "处罚方式"],
      violationRows,
      notes: replacementHint
    }
  };
}
