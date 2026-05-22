import { Divider, Group, Paper, Stack, Text } from '@mantine/core';
import React from 'react';
import { Book, type BookProps } from './Book';

export default {
  title: 'Components/Book',
  args: {
    size: 'md',
    radius: 'xl',
    value: true,
    variant: 'flat',
    intensity: 80,
    animate: false,
    animationType: 'none',
    animationDuration: 1.5,
  },
  argTypes: {
    label: {
      control: 'text',
    },
    justify: {
      control: 'select',
      options: [
        'flex-start',
        'center',
        'flex-end',
        'space-between',
        'space-around',
        'space-evenly',
      ],
    },
    labelPosition: {
      control: 'select',
      options: ['left', 'right'],
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    radius: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
    color: {
      control: 'color',
    },
    variant: {
      control: 'select',
      options: ['flat', '3d'],
    },
    intensity: {
      control: { type: 'range', min: 0, max: 100, step: 10 },
    },
    animationType: {
      control: 'select',
      options: ['none', 'pulse', 'flash', 'breathe', 'blink', 'glow'],
    },
    animationDuration: {
      control: { type: 'range', min: 0.5, max: 10, step: 0.5 },
    },
  },
};

export function Usage() {
  return (
    <Stack gap="xl" p="md">
      <Paper p="md" withBorder>
        <Text fw={500} mb="md">
          Basic BOOK States
        </Text>
        <Group>
          <Stack align="center">
            <Book />
            <Text size="xs">On</Text>
          </Stack>
          <Stack align="center">
            <Book value={false} />
            <Text size="xs">Off</Text>
          </Stack>
        </Group>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={500} mb="md">
          Variants
        </Text>
        <Group>
          <Stack align="center">
            <Book variant="flat" />
            <Text size="xs">Flat</Text>
          </Stack>
          <Stack align="center">
            <Book variant="3d" />
            <Text size="xs">3D</Text>
          </Stack>
        </Group>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={500} mb="md">
          Sizes
        </Text>
        <Group align="flex-end">
          <Stack align="center">
            <Book size="xs" />
            <Text size="xs">XS</Text>
          </Stack>
          <Stack align="center">
            <Book size="sm" />
            <Text size="xs">SM</Text>
          </Stack>
          <Stack align="center">
            <Book size="md" />
            <Text size="xs">MD</Text>
          </Stack>
          <Stack align="center">
            <Book size="lg" />
            <Text size="xs">LG</Text>
          </Stack>
          <Stack align="center">
            <Book size="xl" />
            <Text size="xs">XL</Text>
          </Stack>
        </Group>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={500} mb="md">
          Colors
        </Text>
        <Group>
          {['red', 'green', 'blue', 'yellow', 'orange', 'cyan', 'pink', 'violet'].map((color) => (
            <Stack key={color} align="center">
              <Book color={color} variant="3d" size="lg" />
              <Text size="xs" tt="capitalize">
                {color}
              </Text>
            </Stack>
          ))}
        </Group>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={500} mb="md">
          Intensity Levels (3D variant)
        </Text>
        <Group>
          {[20, 40, 60, 80, 100].map((intensity) => (
            <Stack key={intensity} align="center">
              <Book intensity={intensity} variant="3d" size="lg" />
              <Text size="xs">{intensity}%</Text>
            </Stack>
          ))}
        </Group>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={500} mb="md">
          Animations
        </Text>
        <Group>
          <Stack align="center">
            <Book animate animationType="pulse" size="lg" />
            <Text size="xs">Pulse</Text>
          </Stack>
          <Stack align="center">
            <Book animate animationType="flash" size="lg" color="red" />
            <Text size="xs">Flash</Text>
          </Stack>
          <Stack align="center">
            <Book animate animationType="breathe" size="lg" color="blue" />
            <Text size="xs">Breathe</Text>
          </Stack>
          <Stack align="center">
            <Book animate animationType="blink" size="lg" color="yellow" />
            <Text size="xs">Blink</Text>
          </Stack>
          <Stack align="center">
            <Book animate animationType="glow" size="lg" color="cyan" />
            <Text size="xs">Glow</Text>
          </Stack>
        </Group>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={500} mb="md">
          Animation Speed
        </Text>
        <Group>
          <Stack align="center">
            <Book animate animationType="pulse" animationDuration={0.5} size="lg" />
            <Text size="xs">Fast (0.5s)</Text>
          </Stack>
          <Stack align="center">
            <Book animate animationType="pulse" animationDuration={1.5} size="lg" />
            <Text size="xs">Normal (1.5s)</Text>
          </Stack>
          <Stack align="center">
            <Book animate animationType="pulse" animationDuration={3} size="lg" />
            <Text size="xs">Slow (3s)</Text>
          </Stack>
        </Group>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={500} mb="md">
          Combined Effects (3D + Animation + High Intensity)
        </Text>
        <Group>
          <Book variant="3d" animate animationType="glow" intensity={100} size="xl" color="green" />
          <Book variant="3d" animate animationType="pulse" intensity={90} size="xl" color="red" />
          <Book
            variant="3d"
            animate
            animationType="breathe"
            intensity={95}
            size="xl"
            color="blue"
          />
        </Group>
      </Paper>
    </Stack>
  );
}

export function WithProps(props: BookProps) {
  return <Book {...props} />;
}

export function WithLabel() {
  return (
    <>
      <Group>
        <Book label="Server Online" color="green" />
        <Book label="Server Offline" color="red" value={false} />
        <Book label={<Text c="blue">Custom Label</Text>} color="blue" />
      </Group>
      <Divider />
      <div>
        <Book label="Left Label" labelPosition="left" color="orange" />
      </div>

      <div>
        <Book label="Right Label" labelPosition="right" color="pink" />
      </div>

      <Divider />
      <Stack>
        <Book label="Left Label" labelPosition="left" color="orange" />

        <Book label="Right Label" labelPosition="right" color="pink" />
      </Stack>
    </>
  );
}
