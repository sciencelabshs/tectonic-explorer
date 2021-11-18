import React from "react";
import { inject, observer } from "mobx-react";
import screenfull from "screenfull";
import { ControlGroup } from "./control-group";
import { PlayPauseButton, RestartButton, StepBackButton, StepForwardButton } from "./vcr-buttons";
import ccLogo from "../../images/cc-logo.png";
import ccLogoSmall from "../../images/cc-logo-small.png";
import { Button } from "react-toolbox/lib/button";
import { IconHighlightButton } from "./icon-highlight-button";
import { MapTypeButton } from "./map-type-button";
import { SliderSwitch } from "./slider-switch";
import config, { Colormap } from "../config";
import DrawCrossSectionIconSVG from "../../images/draw-cross-section-icon.svg";
import TakeSampleIconControlSVG from "../../images/take-sample-icon-control.svg";
import ReloadSVG from "../../images/reload.svg";
import { IGlobeInteractionName } from "../plates-interactions/globe-interactions-manager";
import { BaseComponent, IBaseProps } from "./base";

import "../../css/bottom-panel.less";

function toggleFullscreen() {
  if (screenfull.isEnabled) {
    if (!screenfull.isFullscreen) {
      screenfull.request();
    } else {
      screenfull.exit();
    }
  }
}

interface IState {
  fullscreen: boolean;
  width: number;
}

@inject("simulationStore")
@observer
export default class BottomPanel extends BaseComponent<IBaseProps, IState> {
  constructor(props: IBaseProps) {
    super(props);
    this.state = {
      fullscreen: false,
      width: 0
    };
  }

  componentDidMount() {
    if (screenfull.isEnabled) {
      document.addEventListener(screenfull.raw.fullscreenchange, this.fullscreenChange);
    }
  }

  componentWillUnmount() {
    if (screenfull.isEnabled) {
      document.removeEventListener(screenfull.raw.fullscreenchange, this.fullscreenChange);
    }
  }

  get options() {
    return this.simulationStore;
  }

  get playPauseIcon() {
    return this.options.playing ? "pause" : "play_arrow";
  }

  get playPauseLabel() {
    return this.options.playing ? "Stop" : "Start";
  }

  get fullscreenIconStyle() {
    return this.state.fullscreen ? "fullscreen-icon fullscreen" : "fullscreen-icon";
  }

  fullscreenChange = () => {
    this.setState({ fullscreen: screenfull.isEnabled && screenfull.isFullscreen });
  };

  togglePlayPause = () => {
    const { setOption } = this.simulationStore;
    setOption("playing", !this.options.playing);
  };

  setShowEarthquakes = (on: boolean) => {
    this.simulationStore.setEarthquakesVisible(on);
  };

  setShowVolcanicEruptions = (on: boolean) => {
    this.simulationStore.setVolcanicEruptionsVisible(on);
  };

  toggleInteraction = (interaction: IGlobeInteractionName) => {
    const { setInteraction, interaction: currentInteraction } = this.simulationStore;
    setInteraction(currentInteraction === interaction ? "none" : interaction);
  };

  render() {
    const { showDrawCrossSectionButton, showTakeSampleButton, showEarthquakesSwitch, showVolcanoesSwitch } = config;
    const { interaction, colormap } = this.simulationStore;
    const { reload, restoreSnapshot, restoreInitialSnapshot, stepForward } = this.simulationStore;
    const options = this.options;
    const isDrawingCrossSection = interaction === "crossSection";
    const isTakingRockSample = interaction === "takeRockSample";
    const showEventsGroup = showEarthquakesSwitch || showVolcanoesSwitch;

    const setColorMap = (colorMap: Colormap) => {
      this.simulationStore.setOption("colormap", colorMap);
    };

    return (
      <div className="bottom-panel">
        <img src={ccLogo} className="cc-logo-large" data-test="cc-logo-large" />
        <img src={ccLogoSmall} className="cc-logo-small" data-test="cc-logo-small" />
        <div className="middle-widgets">
          {
            config.planetWizard &&
            <Button className="inline-widget" onClick={reload} data-test="reload-button">
              <ReloadSVG />
              <span className="label">Reload</span>
            </Button>
          }
          { config.colormapOptions?.length > 1 &&
            <ControlGroup>
              <MapTypeButton colorMap={colormap} onSetColorMap={setColorMap} />
            </ControlGroup> }
          { showDrawCrossSectionButton &&
            <ControlGroup>
              <IconHighlightButton active={isDrawingCrossSection} disabled={false} data-test="draw-cross-section"
                style={{ width: 92 }} label={<>Draw<br/>Cross-section</>} Icon={DrawCrossSectionIconSVG}
                onClick={() => this.toggleInteraction("crossSection")} />
            </ControlGroup> }
          <ControlGroup>
            <div className="buttons">
              <RestartButton disabled={!options.snapshotAvailable} onClick={restoreInitialSnapshot} data-test="restart-button" />
              <StepBackButton disabled={!options.snapshotAvailable} onClick={restoreSnapshot} data-test="step-back-button" />
              <PlayPauseButton isPlaying={options.playing} onClick={this.togglePlayPause} data-test="playPause-button" />
              <StepForwardButton disabled={options.playing} onClick={stepForward} data-test="step-forward-button" />
            </div>
          </ControlGroup>
          { !config.geode && showTakeSampleButton &&
            <ControlGroup>
              <IconHighlightButton active={isTakingRockSample} disabled={false} style={{ width: 64 }} data-test="take-sample"
                label={<>Take<br/>Sample</>} Icon={TakeSampleIconControlSVG}
                onClick={() => this.toggleInteraction("takeRockSample")} />
            </ControlGroup> }
          { showEventsGroup &&
            <ControlGroup>
              <div className="event-buttons">
                { showVolcanoesSwitch &&
                  <SliderSwitch label="Volcanoes"
                    isOn={this.simulationStore.volcanicEruptions} onSet={this.setShowVolcanicEruptions}/> }
                { showEarthquakesSwitch &&
                  <SliderSwitch label="Earthquakes"
                    isOn={this.simulationStore.earthquakes} onSet={this.setShowEarthquakes}/> }
              </div>
            </ControlGroup> }
        </div>
        <div className="right-widgets">
          {
            screenfull.isEnabled &&
            <div className={this.fullscreenIconStyle} onClick={toggleFullscreen} title="Toggle Fullscreen" data-test="fullscreen-button" />
          }
        </div>
      </div>
    );
  }
}
