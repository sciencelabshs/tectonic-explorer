import { IDataset, IRuntimeInteractiveMetadata } from "@concord-consortium/lara-interactive-api";

export interface IInteractiveState extends IRuntimeInteractiveMetadata {
  dataset: IDataset;
  planetViewSnapshot?: string;
  crossSectionSnapshot?: string;
}

export interface IVector2 {
  x: number;
  y: number;
}

export type TempPressureValue = null | "Low" | "Med" | "High";

export type ICrossSectionWall = "front" | "back" | "top" | "left" | "right";

export type RockKeyLabel = "Granite" | "Basalt" | "Gabbro" | "Rhyolite" | "Andesite" | "Diorite" | "Limestone" |
  "Shale" | "Sandstone" | "Oceanic Sediments" | "Continental Sediments" | "Mantle (brittle)" | "Mantle (ductile)" |
  "Low Grade Metamorphic Rock (Subduction Zone)" | "Medium Grade Metamorphic Rock (Subduction Zone)" | "High Grade Metamorphic Rock (Subduction Zone)" |
  "Low Grade Metamorphic Rock (Continental Collision)" | "Medium Grade Metamorphic Rock (Continental Collision)" | "High Grade Metamorphic Rock (Continental Collision)" |
  "Contact Metamorphism" | "Iron-poor Magma" | "Intermediate Magma" | "Iron-rich Magma" | "Sky" | "Ocean";

export interface IDataSample {
  id: string;
  crossSectionWall: ICrossSectionWall;
  coords: IVector2;
  type: RockKeyLabel;
  temperature: TempPressureValue;
  pressure: TempPressureValue;
  notes?: string;
  selected?: boolean;
}

export type DataSampleColumnName = "category" | "type" | "temperatureAndPressure" | "ironContent" | "cooling" | "metamorphicGrade" | "particlesSize" | "magmaTemperature" | "notes";

export type DataSampleCategory = "Igneous" | "Mantle" | "Metamorphic" | "Sedimentary" | "Sediments" | "Magma" | "Other";

export interface IDataSampleInfo {
  category: DataSampleCategory;
  pattern: JSX.Element;
  ironContent?: JSX.Element; // Igneous Rocks, Mantle Rocks, Magma
  cooling?: JSX.Element; // Igneous Rocks
  metamorphicGrade?: JSX.Element; // Metamorphic Rocks
  particlesSize?: JSX.Element; // Sedimentary Rocks
  magmaTemperature?: JSX.Element; // Magma
}

export const DATASET_PROPS: Array<keyof IDataSample> = ["id", "type", "temperature", "pressure", "notes"];
