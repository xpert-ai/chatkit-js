import { render, screen, waitFor } from '@testing-library/react';
import { A2UIProvider, Types } from '@xpert-ai/a2ui-react';
import { describe, expect, it, vi } from 'vitest';
import { WidgetMessage } from './widget';

function renderWidget(data: Parameters<typeof WidgetMessage>[0]['data']) {
  return render(
    <A2UIProvider>
      <WidgetMessage messageId="message-1" data={data} />
    </A2UIProvider>,
  );
}

describe('WidgetMessage', () => {
  it('renders flat A2UI messages', async () => {
    renderWidget({
      type: 'Widget',
      widgets: [
        {
          name: 'flat',
          messages: [
            {
              surfaceUpdate: {
                surfaceId: '@default',
                components: [
                  {
                    id: 'root',
                    component: {
                      Text: { text: { literalString: 'Flat widget' } },
                    },
                  },
                ],
              },
            },
            {
              beginRendering: {
                surfaceId: '@default',
                root: 'root',
              },
            },
          ],
        },
      ],
    });

    expect(await screen.findByText('Flat widget')).toBeInTheDocument();
  });

  it('rewrites surface ids for multiple flat widgets', async () => {
    renderWidget({
      type: 'Widget',
      widgets: [
        {
          name: 'first',
          messages: createTextSurfaceMessages('First widget'),
        },
        {
          name: 'second',
          messages: createTextSurfaceMessages('Second widget'),
        },
      ],
    });

    expect(await screen.findByText('First widget')).toBeInTheDocument();
    expect(await screen.findByText('Second widget')).toBeInTheDocument();
  });

  it('renders real generated sales dashboard tool call args without crashing', async () => {
    const [toolCall] = createSalesYoyDashboardToolCalls();

    renderWidget({
      type: 'Widget',
      widgets: [
        {
          name: toolCall.args.name,
          messages: toolCall.args
            .messages as unknown as Types.ServerToClientMessage[],
        },
      ],
    });

    expect(
      await screen.findByText('Sales YoY Rate Dashboard'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Order Date')).toBeInTheDocument();
    expect(await screen.findByText('2017-07-01')).toBeInTheDocument();
    expect(await screen.findByText('28408.86')).toBeInTheDocument();
    expect(
      await screen.findByText('+516.41% (2017-08-17)'),
    ).toBeInTheDocument();
  });

  it('renders generated sales dashboard v2 rows from flattened row keys', async () => {
    const [toolCall] = createSalesYoyDashboardV2ToolCalls();

    renderWidget({
      type: 'Widget',
      widgets: [
        {
          name: toolCall.args.name,
          messages: toolCall.args
            .messages as unknown as Types.ServerToClientMessage[],
        },
      ],
    });

    expect(
      await screen.findByText('Sales YoY Rate Dashboard'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Order Date')).toBeInTheDocument();
    expect(await screen.findByText('2017-07-01')).toBeInTheDocument();
    expect(await screen.findByText('28408.86')).toBeInTheDocument();
    expect(await screen.findByText('2017-07-02')).toBeInTheDocument();
    expect(await screen.findByText('42734.32')).toBeInTheDocument();
  });

  it('shows fallback when flat widget messages contain invalid component references', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      renderWidget({
        type: 'Widget',
        widgets: [
          {
            name: 'generated_surface',
            messages: createInvalidGeneratedSurfaceMessages(),
          },
        ],
      });

      expect(
        await screen.findByText('Widget failed to render.'),
      ).toBeInTheDocument();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('keeps rendering legacy pre-resolved surfaces', async () => {
    renderWidget({
      type: 'Widget',
      widgets: [
        {
          name: 'legacy',
          config: {
            rootComponentId: 'root',
            dataModel: new Map(),
            styles: {},
            components: new Map(),
            componentTree: {
              id: 'root',
              type: 'Text',
              properties: {
                text: { literalString: 'Legacy widget' },
              },
            },
          } as Types.Surface,
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Legacy widget')).toBeInTheDocument();
    });
  });
});

function createTextSurfaceMessages(
  text: string,
): Types.ServerToClientMessage[] {
  return [
    {
      surfaceUpdate: {
        surfaceId: '@default',
        components: [
          {
            id: 'root',
            component: {
              Text: { text: { literalString: text } },
            },
          },
        ],
      },
    },
    {
      beginRendering: {
        surfaceId: '@default',
        root: 'root',
      },
    },
  ];
}

function createInvalidGeneratedSurfaceMessages(): Types.ServerToClientMessage[] {
  return [
    {
      dataModelUpdate: {
        surfaceId: '@default',
        path: '/',
        contents: [
          { key: 'title', valueString: 'CEO Daily Brief' },
          { key: 'summary', valueString: 'Daily operating summary.' },
          { key: 'section1_title', valueString: '1. Key findings' },
          { key: 'section1_content', valueString: 'Revenue increased today.' },
        ],
      },
    },
    {
      surfaceUpdate: {
        surfaceId: '@default',
        components: [
          column('root', [
            'title',
            'summary',
            'divider1',
            'section1_title',
            'section1_content',
          ]),
          divider('divider1'),
        ],
      },
    },
    {
      beginRendering: {
        surfaceId: '@default',
        root: 'root',
      },
    },
  ];
}

function createSalesYoyDashboardToolCalls() {
  return [
    {
      name: 'render_a2ui_surface',
      args: {
        name: 'sales-yoy-dashboard',
        messages: createSalesYoyDashboardMessages(),
      },
      id: 'tool-048a165fcffb4c1da22b1863595dc3ed',
      type: 'tool_call',
    },
  ];
}

function createSalesYoyDashboardV2ToolCalls() {
  return [
    {
      name: 'render_a2ui_surface',
      args: {
        name: 'sales-yoy-dashboard-v2',
        messages: createSalesYoyDashboardV2Messages(),
      },
      id: 'tool-bb9e093c81ae4fb4b23155af24c19df4',
      type: 'tool_call',
    },
  ];
}

function createSalesYoyDashboardMessages() {
  return [
    {
      dataModelUpdate: {
        surfaceId: '@default',
        path: '/',
        contents: [
          { key: 'title', valueString: 'Sales YoY Rate Dashboard' },
          {
            key: 'subtitle',
            valueString: 'Sales Amount vs Year-over-Year Growth Rate (Daily)',
          },
          { key: 'totalRows', valueNumber: 2735 },
          { key: 'previewRows', valueNumber: 50 },
          {
            key: 'note',
            valueString:
              'Full result: 2,735 rows. Preview shows first 50 rows. YoY Rate is null for dates without prior-year data (first 12 months).',
          },
        ],
      },
    },
    {
      dataModelUpdate: {
        surfaceId: '@default',
        path: '/summaryCards',
        contents: [
          { key: 'card1_title', valueString: 'Total Rows' },
          { key: 'card1_value', valueString: '2,735' },
          { key: 'card2_title', valueString: 'Preview Rows' },
          { key: 'card2_value', valueString: '50' },
          { key: 'card3_title', valueString: 'Date Range' },
          { key: 'card3_value', valueString: '2017-07 ~ 2018+' },
          { key: 'card4_title', valueString: 'Measures' },
          { key: 'card4_value', valueString: 'Sales Amount, YoY Rate' },
        ],
      },
    },
    {
      dataModelUpdate: {
        surfaceId: '@default',
        path: '/tableRows',
        contents: SALES_YOY_ROWS.flatMap((row, index) => [
          { key: `r${index}_date`, valueString: row.date },
          { key: `r${index}_sales`, valueNumber: row.sales },
          { key: `r${index}_yoy`, valueString: row.yoy },
        ]),
      },
    },
    {
      dataModelUpdate: {
        surfaceId: '@default',
        path: '/highlights',
        contents: [
          { key: 'h1_label', valueString: '📈 Highest YoY Growth' },
          { key: 'h1_value', valueString: '+516.41% (2017-08-17)' },
          { key: 'h2_label', valueString: '📉 Lowest YoY Growth' },
          { key: 'h2_value', valueString: '-60.77% (2017-08-12)' },
          { key: 'h3_label', valueString: '💰 Highest Sales Day' },
          { key: 'h3_value', valueString: '$181,994.51 (2017-08-13)' },
          { key: 'h4_label', valueString: '📊 Null YoY Period' },
          { key: 'h4_value', valueString: '2017-07-01 ~ 2017-07-12' },
        ],
      },
    },
    {
      surfaceUpdate: {
        surfaceId: '@default',
        components: createSalesYoyDashboardComponents(),
      },
    },
    {
      beginRendering: {
        surfaceId: '@default',
        root: 'root',
      },
    },
  ];
}

function createSalesYoyDashboardV2Messages() {
  return [
    {
      dataModelUpdate: {
        surfaceId: '@default',
        path: '/',
        contents: [
          { key: 'title', valueString: 'Sales YoY Rate Dashboard' },
          {
            key: 'subtitle',
            valueString: 'Daily Sales Amount & Year-over-Year Growth Rate',
          },
          {
            key: 'note',
            valueString:
              'Full result: 2,735 rows. Preview shows first 50 rows. YoY Rate is null for dates without prior-year data (first 12 months).',
          },
        ],
      },
    },
    {
      dataModelUpdate: {
        surfaceId: '@default',
        path: '/rows',
        contents: SALES_YOY_ROWS.flatMap((row, index) =>
          index === 0
            ? [
                { key: 'date', valueString: row.date },
                { key: 'sales', valueNumber: row.sales },
                { key: 'yoy', valueString: row.yoy },
              ]
            : [
                { key: `row_${index}_date`, valueString: row.date },
                { key: `row_${index}_sales`, valueNumber: row.sales },
                { key: `row_${index}_yoy`, valueString: row.yoy },
              ],
        ),
      },
    },
    {
      surfaceUpdate: {
        surfaceId: '@default',
        components: createSalesYoyDashboardV2Components(),
      },
    },
    {
      beginRendering: {
        surfaceId: '@default',
        root: 'root',
      },
    },
  ];
}

function createSalesYoyDashboardComponents() {
  return [
    column('root', [
      'titleBar',
      'divider1',
      'summaryRow',
      'divider2',
      'highlightsRow',
      'divider3',
      'noteCard',
      'divider4',
      'tableHeader',
      'tableBody',
    ]),
    column('titleBar', ['mainTitle', 'subTitle']),
    text('mainTitle', { path: '/title' }, { fontSize: '20', fontWeight: 'bold' }),
    text(
      'subTitle',
      { path: '/subtitle' },
      { fontSize: '14', color: '#666' },
    ),
    divider('divider1'),
    row('summaryRow', ['card1', 'card2', 'card3', 'card4']),
    ...metricCard('card1', 'c1t', 'c1v'),
    ...metricCard('card2', 'c2t', 'c2v'),
    ...metricCard('card3', 'c3t', 'c3v'),
    ...metricCard('card4', 'c4t', 'c4v'),
    divider('divider2'),
    row('highlightsRow', ['hl1', 'hl2', 'hl3', 'hl4']),
    ...highlightCard('hl1', 'hl1l', 'hl1v', '#2e7d32'),
    ...highlightCard('hl2', 'hl2l', 'hl2v', '#c62828'),
    ...highlightCard('hl3', 'hl3l', 'hl3v', '#1565c0'),
    ...highlightCard('hl4', 'hl4l', 'hl4v', '#666'),
    divider('divider3'),
    card('noteCard', ['noteText']),
    text('noteText', { path: '/note' }, { fontSize: '12', color: '#555' }),
    divider('divider4'),
    {
      id: 'tableHeader',
      component: {
        Row: {
          children: { explicitList: ['thDate', 'thSales', 'thYoY'] },
          weight: { literalNumber: 1 },
        },
      },
    },
    text('thDate', 'Order Date', {
      fontSize: '13',
      fontWeight: 'bold',
      color: '#333',
    }),
    text('thSales', 'Sales Amount', {
      fontSize: '13',
      fontWeight: 'bold',
      color: '#333',
    }),
    text('thYoY', 'YoY Sales Rate', {
      fontSize: '13',
      fontWeight: 'bold',
      color: '#333',
    }),
    {
      id: 'tableBody',
      component: {
        List: {
          children: {
            template: {
              dataPath: '/tableRows',
              itemTemplate: {
                id: 'rowItem',
                component: {
                  Row: {
                    children: {
                      explicitList: ['riDate', 'riSales', 'riYoY'],
                    },
                  },
                },
              },
              keyField: 'key',
            },
            direction: 'vertical',
          },
        },
      },
    },
    text('riDate', { path: '/tableRows/r{index}_date' }, { fontSize: '12' }),
    text('riSales', { path: '/tableRows/r{index}_sales' }, { fontSize: '12' }),
    text('riYoY', { path: '/tableRows/r{index}_yoy' }, { fontSize: '12' }),
  ];
}

function createSalesYoyDashboardV2Components() {
  return [
    column('root', ['titleSection', 'tableSection']),
    column('titleSection', ['mainTitle', 'subTitle']),
    {
      id: 'mainTitle',
      weight: 1,
      component: {
        Text: {
          text: { path: '/title' },
          usageHint: 'h1',
        },
      },
    },
    {
      id: 'subTitle',
      weight: 1,
      component: {
        Text: {
          text: { path: '/subtitle' },
          usageHint: 'caption',
        },
      },
    },
    column('tableSection', ['tableHeaderRow', 'tableList']),
    row('tableHeaderRow', ['thDate', 'thSales', 'thYoY']),
    {
      id: 'thDate',
      weight: 2,
      component: {
        Text: {
          text: { literalString: 'Order Date' },
          usageHint: 'h5',
        },
      },
    },
    {
      id: 'thSales',
      weight: 2,
      component: {
        Text: {
          text: { literalString: 'Sales Amount' },
          usageHint: 'h5',
        },
      },
    },
    {
      id: 'thYoY',
      weight: 2,
      component: {
        Text: {
          text: { literalString: 'YoY Sales Rate' },
          usageHint: 'h5',
        },
      },
    },
    {
      id: 'tableList',
      weight: 5,
      component: {
        List: {
          children: {
            template: {
              componentId: 'rowTemplate',
              dataBinding: '/rows',
            },
          },
        },
      },
    },
    row('rowTemplate', ['tdDate', 'tdSales', 'tdYoY']),
    {
      id: 'tdDate',
      weight: 2,
      component: {
        Text: {
          text: { path: 'date' },
          usageHint: 'body',
        },
      },
    },
    {
      id: 'tdSales',
      weight: 2,
      component: {
        Text: {
          text: { path: 'sales' },
          usageHint: 'body',
        },
      },
    },
    {
      id: 'tdYoY',
      weight: 2,
      component: {
        Text: {
          text: { path: 'yoy' },
          usageHint: 'body',
        },
      },
    },
  ];
}

function column(id: string, children: string[]) {
  return {
    id,
    component: {
      Column: {
        children: { explicitList: children },
      },
    },
  };
}

function row(id: string, children: string[]) {
  return {
    id,
    component: {
      Row: {
        children: { explicitList: children },
      },
    },
  };
}

function card(id: string, children: string[]) {
  return {
    id,
    component: {
      Card: {
        children: { explicitList: children },
      },
    },
  };
}

function divider(id: string) {
  return {
    id,
    component: {
      Divider: {},
    },
  };
}

function text(
  id: string,
  value: string | { path: string },
  style?: Record<string, string>,
) {
  return {
    id,
    component: {
      Text: {
        text: value,
        ...(style ? { style } : {}),
      },
    },
  };
}

function metricCard(id: string, titleId: string, valueId: string) {
  const index = id.replace('card', '');
  return [
    card(id, [titleId, valueId]),
    text(
      titleId,
      { path: `/summaryCards/card${index}_title` },
      { fontSize: '12', color: '#888' },
    ),
    text(
      valueId,
      { path: `/summaryCards/card${index}_value` },
      { fontSize: '18', fontWeight: 'bold' },
    ),
  ];
}

function highlightCard(
  id: string,
  labelId: string,
  valueId: string,
  color: string,
) {
  const index = id.replace('hl', '');
  return [
    card(id, [labelId, valueId]),
    text(
      labelId,
      { path: `/highlights/h${index}_label` },
      { fontSize: '11', color: '#888' },
    ),
    text(
      valueId,
      { path: `/highlights/h${index}_value` },
      { fontSize: '14', fontWeight: 'bold', color },
    ),
  ];
}

const SALES_YOY_ROWS = [
  { date: '2017-07-01', sales: 28408.86, yoy: 'N/A' },
  { date: '2017-07-02', sales: 42734.32, yoy: 'N/A' },
  { date: '2017-07-03', sales: 29325.26, yoy: 'N/A' },
  { date: '2017-07-04', sales: 15711.28, yoy: 'N/A' },
  { date: '2017-07-05', sales: 65487.04, yoy: 'N/A' },
  { date: '2017-07-06', sales: 28447.88, yoy: 'N/A' },
  { date: '2017-07-07', sales: 100241.78, yoy: 'N/A' },
  { date: '2017-07-08', sales: 25543.71, yoy: 'N/A' },
  { date: '2017-07-09', sales: 26144.55, yoy: 'N/A' },
  { date: '2017-07-10', sales: 79590.26, yoy: 'N/A' },
  { date: '2017-07-11', sales: 14313.08, yoy: 'N/A' },
  { date: '2017-07-12', sales: 44363.37, yoy: 'N/A' },
  { date: '2017-07-13', sales: 25746.99, yoy: '-9.37%' },
  { date: '2017-07-14', sales: 28968.7, yoy: '-32.21%' },
  { date: '2017-07-15', sales: 55955.49, yoy: '+90.81%' },
  { date: '2017-07-16', sales: 41960.8, yoy: '+167.07%' },
  { date: '2017-07-17', sales: 55447.68, yoy: '-15.33%' },
  { date: '2017-07-18', sales: 52272.06, yoy: '+83.75%' },
  { date: '2017-07-19', sales: 50909.34, yoy: '-49.21%' },
  { date: '2017-07-20', sales: 82516.94, yoy: '+223.04%' },
  { date: '2017-07-21', sales: 25162.15, yoy: '-3.76%' },
  { date: '2017-07-22', sales: 44575.89, yoy: '-43.99%' },
  { date: '2017-07-23', sales: 36135.92, yoy: '+152.47%' },
  { date: '2017-07-24', sales: 40147.82, yoy: '-9.50%' },
  { date: '2017-07-25', sales: 37562.71, yoy: '+45.89%' },
  { date: '2017-07-26', sales: 73670.79, yoy: '+154.31%' },
  { date: '2017-07-27', sales: 28016.32, yoy: '-49.93%' },
  { date: '2017-07-28', sales: 29094.39, yoy: '-30.66%' },
  { date: '2017-07-29', sales: 116318.97, yoy: '+109.78%' },
  { date: '2017-07-30', sales: 71221.64, yoy: '+36.25%' },
  { date: '2017-07-31', sales: 27361.37, yoy: '-46.25%' },
  { date: '2017-08-01', sales: 88289.85, yoy: '+6.99%' },
  { date: '2017-08-02', sales: 39129.72, yoy: '+55.51%' },
  { date: '2017-08-03', sales: 45041.57, yoy: '+1.04%' },
  { date: '2017-08-04', sales: 70946.39, yoy: '+96.33%' },
  { date: '2017-08-05', sales: 24176.87, yoy: '-39.78%' },
  { date: '2017-08-06', sales: 23149.45, yoy: '-38.37%' },
  { date: '2017-08-07', sales: 141115.89, yoy: '+91.55%' },
  { date: '2017-08-08', sales: 35364.78, yoy: '+26.23%' },
  { date: '2017-08-09', sales: 51761.61, yoy: '+77.91%' },
  { date: '2017-08-10', sales: 62075.75, yoy: '-46.63%' },
  { date: '2017-08-11', sales: 38178.95, yoy: '-46.39%' },
  { date: '2017-08-12', sales: 10734.81, yoy: '-60.77%' },
  { date: '2017-08-13', sales: 181994.51, yoy: '+106.13%' },
  { date: '2017-08-14', sales: 36115.31, yoy: '-7.70%' },
  { date: '2017-08-15', sales: 17891.35, yoy: '-60.28%' },
  { date: '2017-08-16', sales: 96433.19, yoy: '+35.92%' },
  { date: '2017-08-17', sales: 149029.2, yoy: '+516.41%' },
  { date: '2017-08-18', sales: 46235.23, yoy: '+99.72%' },
  { date: '2017-08-19', sales: 95165.97, yoy: '-32.56%' },
];
