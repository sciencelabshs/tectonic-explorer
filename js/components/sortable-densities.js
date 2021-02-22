import React, { Component } from "react";
import { inject, observer } from "mobx-react";
import { SortableContainer, SortableElement, SortableHandle, arrayMove } from "react-sortable-hoc";
import { hsv } from "d3-hsv";
import FontIcon from "react-toolbox/lib/font_icon";
import config from "../config";

import "../../css/sortable-densities.less";

function hueToBackground (hue) {
  const rgb = hsv(hue, 1, 0.4).rgb();
  return { backgroundColor: "rgb(" + Math.floor(rgb.r) + ", " + Math.floor(rgb.g) + ", " + Math.floor(rgb.b) + ")" };
}

const DragHandle = SortableHandle(() => <FontIcon value="menu" className="hamburger-menu" />);

const SortableItem = SortableElement(({ plateInfo }) =>
  <li data-test="density-button" className="density-button-container" style={hueToBackground(plateInfo.hue)}>
    <div className="shading-box">
      <DragHandle />
      <div className="density-button">
        { plateInfo.label }
      </div>
    </div>
  </li>
);

const SortableList = SortableContainer(({ plateInfos }) => {
  return (
    <ul>
      { plateInfos.map((plateInfo, index) => (
        <SortableItem key={`item-${index}`} index={index} plateInfo={plateInfo} />
      )) }
    </ul>
  );
});

@inject("simulationStore") @observer
export default class SortableDensities extends Component {
  constructor (props) {
    super(props);
    this.onSortEnd = this.onSortEnd.bind(this);
    this.updateDensities = this.updateDensities.bind(this);
  }

  get plateInfos () {
    // Convert props into an array of object that works with react-sortable component.
    const plates = this.props.simulationStore.model.plates;
    const plateInfos = plates.map(plate => {
      return {
        id: plate.id,
        hue: plate.hue,
        density: plate.density,
        label: "Plate " + (plate.id + 1)
      };
    });
    plateInfos.sort((infoA, infoB) => infoA.density - infoB.density);
    return plateInfos;
  }

  updateDensities (newPlateInfos) {
    const newDensities = {};
    newPlateInfos.forEach((plateInfo, index) => {
      newDensities[plateInfo.id] = index;
    });
    this.props.simulationStore.setDensities(newDensities);
  }

  onSortEnd ({ oldIndex, newIndex }) {
    this.updateDensities(arrayMove(this.plateInfos, oldIndex, newIndex));
  }

  render () {
    return (
      <div>
        <div className="densities">
          { config.densityWordInPlanetWizard ? "LOW" : "ABOVE" }
          <SortableList plateInfos={this.plateInfos} onSortEnd={this.onSortEnd} useDragHandle={false} />
          { config.densityWordInPlanetWizard ? "HIGH" : "BELOW" }
        </div>
        <div className="helper-text">
          {
            config.densityWordInPlanetWizard
              ? "Click and drag to reorder the plate density"
              : "Click and drag to reorder the plates"
          }
        </div>
      </div>
    );
  }
}
