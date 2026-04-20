import { CommandControls } from "./CommandControls";
import { SectionErrorBoundary } from "./SectionErrorBoundary";
import { TimelineInspector } from "./TimelineInspector";
import {
  useActiveMachine,
  usePanelActions,
  usePanelState,
  usePanelTimelineRetention
} from "../context/PanelProvider";

export const ActiveMachinePanel = () => {
  const {
    activeMachine,
    displayedSnapshot,
    selectedTimelineEntry,
    selectedDiff,
    areCommandsDisabled,
    commandDisabledReason
  } = useActiveMachine();
  const { panelState } = usePanelState();
  const { selectTimelineEntry, setFollowLatest, setDisplayLimit, pruneTimeline, invokeOperation } =
    usePanelActions();
  const retentionCap = usePanelTimelineRetention();

  if (!activeMachine) {
    return null;
  }

  return (
    <>
      <SectionErrorBoundary section="Timeline">
        <TimelineInspector
          entries={activeMachine.timelineEntries}
          selectedIndex={activeMachine.selectedTimelineIndex}
          selectedEntry={selectedTimelineEntry}
          displayedSnapshot={displayedSnapshot}
          selectedDiff={selectedDiff}
          followLatest={activeMachine.followLatest}
          displayLimit={panelState.displayLimit}
          retentionCap={retentionCap}
          onSelectEntry={(index) => selectTimelineEntry(activeMachine.meta.machineId, index)}
          onFollowLatestChange={(followLatest) =>
            setFollowLatest(activeMachine.meta.machineId, followLatest)
          }
          onDisplayLimitChange={setDisplayLimit}
          onPrune={() => pruneTimeline(activeMachine.meta.machineId, panelState.displayLimit)}
        />
      </SectionErrorBoundary>

      <SectionErrorBoundary section="Controls">
        <CommandControls
          features={activeMachine.meta.features}
          snapshotStatus={activeMachine.snapshot.status}
          currentStepId={activeMachine.snapshot.currentStepId}
          disabled={areCommandsDisabled}
          disabledReason={commandDisabledReason}
          mutationsEnabled={activeMachine.meta.mutationsEnabled}
          mode={activeMachine.meta.mode}
          stepIds={activeMachine.meta.stepIds}
          eventTypes={activeMachine.meta.eventTypes}
          eventTypesBySource={activeMachine.meta.eventTypesBySource}
          goToStepTargetsBySource={activeMachine.meta.goToStepTargetsBySource}
          onInvoke={(invocation) => invokeOperation(activeMachine.meta.machineId, invocation)}
        />
      </SectionErrorBoundary>
    </>
  );
};
