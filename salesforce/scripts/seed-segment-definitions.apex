/**
 * Seed Script: Segment Definitions
 *
 * Creates 13 segment definitions with structured JSON criteria.
 * Run via: sf apex run -f salesforce/scripts/seed-segment-definitions.apex -o my-org
 */

// Check for existing segments to avoid duplicates
Set<String> existingApiNames = new Set<String>();
for (Segment_Definition__c existing : [SELECT Api_Name__c FROM Segment_Definition__c]) {
    existingApiNames.add(existing.Api_Name__c);
}

List<Segment_Definition__c> segments = new List<Segment_Definition__c>();

// 1. Northeast Beauty Enthusiasts (Regional)
if (!existingApiNames.contains('northeast_beauty_enthusiasts')) {
    segments.add(new Segment_Definition__c(
        Api_Name__c = 'northeast_beauty_enthusiasts',
        Label__c = 'Northeast Beauty Enthusiasts',
        Description__c = 'Engaged beauty shoppers in the Northeast region',
        Category__c = 'Regional',
        Estimated_Member_Count__c = 3420,
        Is_Active__c = true,
        Criteria_JSON__c = '{"logic":"AND","rules":[{"source":"Contact","field":"MailingState","operator":"IN","values":["CT","DE","MA","MD","ME","NH","NJ","NY","PA","RI","VT"]}]}'
    ));
}

// 2. West Coast Trendsetters (Regional)
if (!existingApiNames.contains('west_coast_trendsetters')) {
    segments.add(new Segment_Definition__c(
        Api_Name__c = 'west_coast_trendsetters',
        Label__c = 'West Coast Trendsetters',
        Description__c = 'Beauty-forward shoppers in the West region',
        Category__c = 'Regional',
        Estimated_Member_Count__c = 2890,
        Is_Active__c = true,
        Criteria_JSON__c = '{"logic":"AND","rules":[{"source":"Contact","field":"MailingState","operator":"IN","values":["AK","CA","CO","HI","ID","MT","NV","OR","UT","WA","WY"]}]}'
    ));
}

// 3. VIP Platinum Members
if (!existingApiNames.contains('vip_platinum_members')) {
    segments.add(new Segment_Definition__c(
        Api_Name__c = 'vip_platinum_members',
        Label__c = 'VIP Platinum Members',
        Description__c = 'Loyalty program Platinum tier members with highest lifetime value',
        Category__c = 'VIP',
        Estimated_Member_Count__c = 620,
        Is_Active__c = true,
        Criteria_JSON__c = '{"logic":"AND","rules":[{"source":"Loyalty","field":"TierName","operator":"EQUALS","values":["Platinum"]}]}'
    ));
}

// 4. High-Value Travelers (Event)
if (!existingApiNames.contains('high_value_travelers')) {
    segments.add(new Segment_Definition__c(
        Api_Name__c = 'high_value_travelers',
        Label__c = 'High-Value Travelers',
        Description__c = 'Customers with travel events detected and high lifetime value',
        Category__c = 'Event',
        Estimated_Member_Count__c = 1240,
        Is_Active__c = true,
        Criteria_JSON__c = '{"logic":"AND","rules":[{"source":"Event","field":"Event_Type__c","operator":"CONTAINS_ANY","values":["travel","trip","vacation"]},{"source":"Order","field":"LifetimeValue","operator":"GREATER_THAN","values":["500"]}]}'
    ));
}

// 5. Wedding Season 2026 (Event)
if (!existingApiNames.contains('wedding_season_2026')) {
    segments.add(new Segment_Definition__c(
        Api_Name__c = 'wedding_season_2026',
        Label__c = 'Wedding Season 2026',
        Description__c = 'Customers with upcoming wedding events or who have browsed bridal beauty collections',
        Category__c = 'Event',
        Estimated_Member_Count__c = 890,
        Is_Active__c = true,
        Criteria_JSON__c = '{"logic":"AND","rules":[{"source":"Event","field":"Event_Type__c","operator":"CONTAINS_ANY","values":["wedding","bridal","engagement"]}]}'
    ));
}

// 6. Birthday This Month (Lifecycle)
if (!existingApiNames.contains('birthday_month')) {
    segments.add(new Segment_Definition__c(
        Api_Name__c = 'birthday_month',
        Label__c = 'Birthday This Month',
        Description__c = 'Customers with birthdays in the current month — high-conversion window for gifting',
        Category__c = 'Lifecycle',
        Estimated_Member_Count__c = 2150,
        Is_Active__c = true,
        Criteria_JSON__c = '{"logic":"AND","rules":[{"source":"Profile","field":"birthday","operator":"MONTH_EQUALS","values":["CURRENT"]}]}'
    ));
}

// 7. Skincare Enthusiasts (Behavioral)
if (!existingApiNames.contains('skincare_enthusiasts')) {
    segments.add(new Segment_Definition__c(
        Api_Name__c = 'skincare_enthusiasts',
        Label__c = 'Skincare Enthusiasts',
        Description__c = 'Customers who browse skincare products or have a detailed skincare profile',
        Category__c = 'Behavioral',
        Estimated_Member_Count__c = 4200,
        Is_Active__c = true,
        Criteria_JSON__c = '{"logic":"OR","rules":[{"source":"Browse","field":"Categories_Browsed__c","operator":"CONTAINS_ANY","values":["skincare","skin care","anti-aging","moisturizer"]},{"source":"Contact","field":"Skin_Type__c","operator":"IS_NOT_NULL","values":[]}]}'
    ));
}

// 8. Fragrance Lovers (Behavioral)
if (!existingApiNames.contains('fragrance_lovers')) {
    segments.add(new Segment_Definition__c(
        Api_Name__c = 'fragrance_lovers',
        Label__c = 'Fragrance Lovers',
        Description__c = 'Customers with strong fragrance browsing history or fragrance-related events',
        Category__c = 'Behavioral',
        Estimated_Member_Count__c = 2890,
        Is_Active__c = true,
        Criteria_JSON__c = '{"logic":"OR","rules":[{"source":"Browse","field":"Categories_Browsed__c","operator":"CONTAINS_ANY","values":["fragrance","perfume","cologne","scent"]},{"source":"Event","field":"Description__c","operator":"CONTAINS_ANY","values":["fragrance","perfume"]}]}'
    ));
}

// 9. New Customer Welcome (Lifecycle)
if (!existingApiNames.contains('new_customer_welcome')) {
    segments.add(new Segment_Definition__c(
        Api_Name__c = 'new_customer_welcome',
        Label__c = 'New Customer Welcome',
        Description__c = 'First-time customers within 30 days of initial purchase — nurture window',
        Category__c = 'Lifecycle',
        Estimated_Member_Count__c = 1870,
        Is_Active__c = true,
        Criteria_JSON__c = '{"logic":"AND","rules":[{"source":"Order","field":"DaysSinceFirstOrder","operator":"LESS_THAN","values":["30"]}]}'
    ));
}

// 10. Lapsed High-Value (Lifecycle)
if (!existingApiNames.contains('lapsed_high_value')) {
    segments.add(new Segment_Definition__c(
        Api_Name__c = 'lapsed_high_value',
        Label__c = 'Lapsed High-Value',
        Description__c = 'Previously high-spending customers with no purchase in 60+ days — win-back candidates',
        Category__c = 'Lifecycle',
        Estimated_Member_Count__c = 980,
        Is_Active__c = true,
        Criteria_JSON__c = '{"logic":"AND","rules":[{"source":"Order","field":"LifetimeValue","operator":"GREATER_THAN","values":["500"]},{"source":"Order","field":"DaysSinceLastOrder","operator":"GREATER_THAN","values":["60"]}]}'
    ));
}

// 11. Holiday Gift Givers (Lifecycle)
if (!existingApiNames.contains('holiday_gift_givers')) {
    segments.add(new Segment_Definition__c(
        Api_Name__c = 'holiday_gift_givers',
        Label__c = 'Holiday Gift Givers',
        Description__c = 'Customers who purchase heavily during holiday season — gift set and bundle buyers',
        Category__c = 'Lifecycle',
        Estimated_Member_Count__c = 3100,
        Is_Active__c = true,
        Criteria_JSON__c = '{"logic":"AND","rules":[{"source":"Order","field":"HolidayOrderCount","operator":"GREATER_THAN","values":["0"]}]}'
    ));
}

// 12. New Parent Nurture (Event)
if (!existingApiNames.contains('new_parent_nurture')) {
    segments.add(new Segment_Definition__c(
        Api_Name__c = 'new_parent_nurture',
        Label__c = 'New Parent Nurture',
        Description__c = 'Customers expecting or with new baby — gentle skincare and self-care focus',
        Category__c = 'Event',
        Estimated_Member_Count__c = 710,
        Is_Active__c = true,
        Criteria_JSON__c = '{"logic":"AND","rules":[{"source":"Event","field":"Event_Type__c","operator":"CONTAINS_ANY","values":["baby","pregnant","parent","expecting","newborn","maternity"]}]}'
    ));
}

// 13. Anniversary Celebrations (Event)
if (!existingApiNames.contains('anniversary_celebrations')) {
    segments.add(new Segment_Definition__c(
        Api_Name__c = 'anniversary_celebrations',
        Label__c = 'Anniversary Celebrations',
        Description__c = 'Customers with anniversary events detected from conversations or profile data',
        Category__c = 'Event',
        Estimated_Member_Count__c = 540,
        Is_Active__c = true,
        Criteria_JSON__c = '{"logic":"OR","rules":[{"source":"Event","field":"Event_Type__c","operator":"CONTAINS_ANY","values":["anniversary"]},{"source":"Profile","field":"anniversary","operator":"IS_NOT_NULL","values":[]}]}'
    ));
}

if (!segments.isEmpty()) {
    insert segments;
    System.debug('Created ' + segments.size() + ' segment definitions');
} else {
    System.debug('All segment definitions already exist');
}

// Verify
for (Segment_Definition__c sd : [
    SELECT Api_Name__c, Label__c, Category__c, Is_Active__c
    FROM Segment_Definition__c
    WHERE Is_Active__c = true
    ORDER BY Category__c, Label__c
]) {
    System.debug(sd.Category__c + ' | ' + sd.Api_Name__c + ' | ' + sd.Label__c);
}
