export type RockSampleColumnName = "category" | "type" | "temperatureAndPressure" | "ironContent" | "cooling" | "metamorphicGrade" | "particlesSize" | "magmaTemperature" | "notes";

export type RockCategory = "Igneous" | "Mantle" | "Metamorphic" | "Sedimentary" | "Sediments" | "Magma" | "Other";

export interface IDataSampleInfo {
  category: RockCategory;
  pattern: JSX.Element;
  ironContent?: JSX.Element; // Igneous Rocks, Mantle Rocks, Magma
  cooling?: JSX.Element; // Igneous Rocks
  metamorphicGrade?: JSX.Element; // Metamorphic Rocks
  particlesSize?: JSX.Element; // Sedimentary Rocks
  magmaTemperature?: JSX.Element; // Magma
}
