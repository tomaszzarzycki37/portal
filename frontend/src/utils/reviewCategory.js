export const REVIEW_CATEGORY_VALUES = ['test', 'news', 'guide', 'opinion']

export function getReviewCategoryLabel(category, t) {
  const value = String(category || 'test').toLowerCase()

  if (value === 'news') return t.adminPanel.reviewCategoryNews
  if (value === 'guide') return t.adminPanel.reviewCategoryGuide
  if (value === 'opinion') return t.adminPanel.reviewCategoryOpinion
  return t.adminPanel.reviewCategoryTest
}
