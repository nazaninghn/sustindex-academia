/* Filters the Question admin's Category dropdown to the currently selected
 * Survey. Category options are rendered as "SurveyName - CategoryName" (see
 * Category.__str__), so we match on that prefix. Purely a UX convenience —
 * Question.clean() already enforces server-side that category.survey matches
 * survey, so an unfiltered/stale selection is never silently accepted.
 */
(function () {
  'use strict';

  function filterCategories(surveySelect, categorySelect) {
    var surveyOption = surveySelect.options[surveySelect.selectedIndex];
    var surveyName = surveyOption ? surveyOption.text.trim() : '';
    var prefix = surveyName ? surveyName + ' - ' : null;
    var currentValue = categorySelect.value;
    var currentStillVisible = false;

    Array.prototype.forEach.call(categorySelect.options, function (opt) {
      if (!opt.value) {
        opt.hidden = false;
        return;
      }
      var matches = !prefix || opt.text.indexOf(prefix) === 0;
      opt.hidden = !matches;
      if (matches && opt.value === currentValue) {
        currentStillVisible = true;
      }
    });

    // If the previously selected category no longer belongs to this survey,
    // reset to the blank option rather than silently keeping a mismatched pick.
    if (currentValue && !currentStillVisible) {
      categorySelect.value = '';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var surveySelect = document.getElementById('id_survey');
    var categorySelect = document.getElementById('id_category');
    if (!surveySelect || !categorySelect) return;

    filterCategories(surveySelect, categorySelect);
    surveySelect.addEventListener('change', function () {
      filterCategories(surveySelect, categorySelect);
    });
  });
})();
