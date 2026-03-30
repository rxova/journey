import { createJourney } from "@rxova/journey-react";
import { onboardingJourney } from "../../core/examples/onboarding.flow";

export { onboardingJourney } from "../../core/examples/onboarding.flow";

const journey = createJourney(onboardingJourney);

const Welcome = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Start onboarding</button>;
};

const Profile = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Save profile</button>;
};

const TeamInvite = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.goToNextStep()}>Skip invite</button>;
};

const Recap = () => {
  const api = journey.useJourneyApi();
  return <button onClick={() => api.completeJourney()}>Finish</button>;
};
const views = {
  welcome: Welcome,
  profile: Profile,
  teamInvite: TeamInvite,
  recap: Recap
};

export const OnboardingExample = () => {
  return (
    <journey.JourneyProvider views={views}>
      <journey.StepRenderer />
    </journey.JourneyProvider>
  );
};
