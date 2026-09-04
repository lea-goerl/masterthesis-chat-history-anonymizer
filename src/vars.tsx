// Prolific completion code for a COMPLETED study (the "Default" completion path
// in Prolific). The app itself no longer redirects to Prolific anywhere: the
// help path keeps the participant inside the tool, and the main flow hands over
// to Qualtrics, whose end-of-survey redirect is what returns the participant to
// Prolific with this code. This code must therefore be configured in Qualtrics
// (End of Survey → redirect to https://app.prolific.com/submissions/complete?cc=…).
// Kept here for reference only. NOTE: the study's *screen-out* path has a
// DIFFERENT code — that one belongs only on the Qualtrics screener branch.
export function getProlificReturnCode() {
  return "CXD5YAJ1";
}

// Qualtrics survey the participant is sent to AFTER a successful data donation.
// The donation happens first (before the questionnaire) so the survey can't
// bias the donation. The Prolific ID is appended as ?PROLIFIC_PID=... so
// Qualtrics can capture it as embedded data and, when the survey ends, redirect
// back to Prolific with the completion code above.
export function getQualtricsSurveyUrl() {
  return "https://migroup.qualtrics.com/jfe/form/SV_0ighIWW4ZMP215c";
}

// The participant identifier passed in the entry URL. Prolific fills it as
// PROLIFIC_PID; older/other entry points use id_one. We accept EITHER, so the
// exact query-parameter name on the study link no longer matters.
export function getParticipantId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("id_one") ?? params.get("PROLIFIC_PID");
}
