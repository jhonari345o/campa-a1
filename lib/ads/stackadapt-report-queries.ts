// Fixed read-only operations. Never accept GraphQL supplied by the browser.
const metrics = `cost impressionsBigint clicksBigint conversions videoCompletionsBigint uniqueImpressionsBigint frequency`;
export const STACKADAPT_CAMPAIGN_SCOPE_QUERY = `query OneStackAdaptCampaignScope($id: ID!) {
  campaign(id: $id) { id advertiser { id } }
}`;
export const STACKADAPT_DASHBOARD_QUERY = `query OneStackAdaptDashboard($filter: CampaignFilters!, $date: DateRangeInput!, $after: String, $includeDaily: Boolean!) {
  summary: campaignDelivery(dataType: TABLE, granularity: TOTAL, date: $date, filterBy: $filter) {
    __typename
    ... on CampaignDeliveryOutcome {
      totalStats { ${metrics} }
      records(first: 100, after: $after) {
        nodes { campaign { id name advertiser { id } channelType } metrics { ${metrics} } }
        pageInfo { hasNextPage endCursor } totalCount
      }
    }
  }
  daily: campaignDelivery(dataType: GRAPH, granularity: DAILY, date: $date, filterBy: $filter) @include(if: $includeDaily) {
    __typename
    ... on CampaignDeliveryOutcome {
      records(first: 100) {
        nodes { granularity { time type } metrics { cost impressionsBigint clicksBigint conversions videoCompletionsBigint } }
        pageInfo { hasNextPage endCursor } totalCount
      }
    }
  }
}`;
export const STACKADAPT_BREAKDOWN_QUERY = `query OneStackAdaptBreakdown($filter: CampaignFilters!, $date: DateRangeInput!, $attributes: [InsightAttributeField!]!, $after: String) {
  campaignInsight(attributes: $attributes, date: $date, filterBy: $filter) {
    __typename
    ... on CampaignInsightOutcome {
      records(first: 100, after: $after) {
        nodes {
          campaign { id advertiser { id } }
          attributes { deviceType country { code name } region { code name } }
          metrics { impressions clicks }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;
