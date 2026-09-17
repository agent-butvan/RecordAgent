import React from 'react';
import { LeverSwitch, type LeverSwitchProps } from './LeverSwitch';

export type ToggleProps = LeverSwitchProps;

export const Toggle: React.FC<ToggleProps> = (props) => {
  return <LeverSwitch {...props} />;
};

export default Toggle;
