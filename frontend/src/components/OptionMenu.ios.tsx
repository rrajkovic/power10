import { Host, Menu, Picker, Text } from '@expo/ui/swift-ui';
import { buttonStyle, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { Platform } from 'react-native';
import { useTheme } from '@/lib/theme';
import type { MenuOption } from './OptionMenu';

// iPhone version: Apple's native pull-down menu. The button is Liquid Glass
// on iOS 26+ (bordered on older iOS), and the list shows a checkmark on the
// current choice. Android and the web use OptionMenu.tsx.

type OptionMenuProps<T extends string> = {
  options: MenuOption<T>[];
  value: T;
  onChange: (value: T) => void;
  // Same props as OptionMenu.tsx; on iPhone both look like native buttons.
  appearance?: 'pill' | 'label';
  accessibilityLabel?: string;
};

const supportsGlass = parseInt(String(Platform.Version), 10) >= 26;

export function OptionMenu<T extends string>({ options, value, onChange }: OptionMenuProps<T>) {
  const { scheme } = useTheme();
  const current = options.find((option) => option.value === value);

  return (
    <Host matchContents colorScheme={scheme}>
      <Menu
        label={current?.label ?? ''}
        modifiers={[buttonStyle(supportsGlass ? 'glass' : 'bordered')]}
      >
        <Picker
          modifiers={[pickerStyle('inline')]}
          selection={value}
          onSelectionChange={(selection) => onChange(selection as T)}
        >
          {options.map((option) => (
            <Text key={option.value} modifiers={[tag(option.value)]}>
              {option.label}
            </Text>
          ))}
        </Picker>
      </Menu>
    </Host>
  );
}
