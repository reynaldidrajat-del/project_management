const { query } = require('../config/db');
const { logActivity } = require('./activityService');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const FIELD_ALIASES = {
  affectedversion: 'affects_version',
  affectedversions: 'affects_version',
  affects_version: 'affects_version',
  affects_versions: 'affects_version',
  assignee: 'assignee',
  assignee_id: 'assignee',
  component: 'component',
  components: 'component',
  created: 'created_at',
  created_at: 'created_at',
  creator: 'creator',
  creator_id: 'creator',
  description: 'description',
  due: 'end_date',
  due_date: 'end_date',
  end_date: 'end_date',
  epic: 'epic',
  epic_id: 'epic',
  fix_version: 'fix_version',
  fix_versions: 'fix_version',
  issue_key: 'issue_key',
  id: 'id',
  issue: 'id',
  issue_type: 'issue_type',
  issuetype: 'issue_type',
  key: 'issue_key',
  label: 'label',
  labels: 'label',
  priority: 'priority',
  project: 'project',
  project_id: 'project',
  reporter: 'creator',
  resolution: 'resolution',
  sprint: 'sprint',
  sprint_id: 'sprint',
  start_date: 'start_date',
  status: 'status',
  story_points: 'story_points',
  summary: 'title',
  text: 'text',
  title: 'title',
  type: 'issue_type',
  updated: 'updated_at',
  updated_at: 'updated_at',
};

const ORDER_FIELDS = {
  assignee: 'assignee_name',
  created: 't.created_at',
  created_at: 't.created_at',
  due: 't.end_date',
  due_date: 't.end_date',
  end_date: 't.end_date',
  issue_key: 't.issue_key',
  key: 't.issue_key',
  priority: 't.priority',
  project: 'p.name',
  status: 't.status',
  story_points: 't.story_points',
  summary: 't.title',
  title: 't.title',
  updated: 't.updated_at',
  updated_at: 't.updated_at',
};

const ISSUE_SELECT = `
  SELECT
    t.id,
    t.project_id,
    p.name AS project_name,
    p.project_key,
    t.issue_key,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.story_points,
    t.assignee_id,
    assignee.name AS assignee_name,
    assignee.email AS assignee_email,
    t.creator_id,
    creator.name AS creator_name,
    t.issue_type_id,
    issue_type.name AS issue_type_name,
    t.sprint_id,
    s.name AS sprint_name,
    t.epic_id,
    epic.epic_name,
    t.workflow_state_id,
    workflow_state.name AS workflow_state_name,
    t.resolution,
    t.environment,
    to_char(t.start_date, 'YYYY-MM-DD') AS start_date,
    to_char(t.end_date, 'YYYY-MM-DD') AS end_date,
    t.progress,
    t.created_at,
    t.updated_at
  FROM tasks t
  INNER JOIN projects p ON p.id = t.project_id
  LEFT JOIN users assignee ON assignee.id = t.assignee_id
  LEFT JOIN users creator ON creator.id = t.creator_id
  LEFT JOIN issue_types issue_type ON issue_type.id = t.issue_type_id
  LEFT JOIN sprints s ON s.id = t.sprint_id
  LEFT JOIN epics epic ON epic.issue_id = t.epic_id
  LEFT JOIN workflow_states workflow_state ON workflow_state.id = t.workflow_state_id
`;

const normalizePositiveInteger = (value) => {
  const normalizedValue = Number(value);
  return Number.isInteger(normalizedValue) && normalizedValue > 0 ? normalizedValue : null;
};

const normalizeLimit = (value) => {
  const normalizedValue = Number(value || DEFAULT_LIMIT);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(normalizedValue, MAX_LIMIT);
};

const normalizeOffset = (value) => {
  const normalizedValue = Number(value || 0);
  return Number.isInteger(normalizedValue) && normalizedValue >= 0 ? normalizedValue : 0;
};

const normalizeArray = (value) => (Array.isArray(value) ? value : [value]);

const unquote = (value) => {
  const text = String(value || '');

  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
  }

  return text;
};

const tokenize = (jql = '') => {
  const tokens = [];
  const pattern = /"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|!=|>=|<=|=|>|<|~|\(|\)|,|\bAND\b|\bOR\b|\bNOT\b|\bIN\b|\bIS\b|\bEMPTY\b|[^\s(),=~<>!]+/gi;
  let match = pattern.exec(jql);

  while (match) {
    tokens.push(match[0]);
    match = pattern.exec(jql);
  }

  return tokens;
};

const getCanonicalField = (fieldToken) => {
  const field = unquote(fieldToken).trim();
  const customFieldMatch = field.match(/^cf\[(.+)\]$/i) || field.match(/^custom(?:field)?\.(.+)$/i);

  if (customFieldMatch) {
    return {
      customFieldName: customFieldMatch[1].trim(),
      name: 'custom_field',
    };
  }

  const normalizedField = field.toLowerCase().replace(/[\s-]+/g, '_');
  const name = FIELD_ALIASES[normalizedField];

  if (!name) {
    throw new Error(`Unsupported JQL field: ${field}.`);
  }

  return { name };
};

class JqlParser {
  constructor(tokens) {
    this.position = 0;
    this.tokens = tokens;
  }

  current() {
    return this.tokens[this.position];
  }

  consume() {
    const token = this.current();
    this.position += 1;
    return token;
  }

  match(value) {
    const token = this.current();

    if (token && token.toUpperCase() === value.toUpperCase()) {
      this.position += 1;
      return true;
    }

    return false;
  }

  expect(value) {
    if (!this.match(value)) {
      throw new Error(`Expected "${value}" in JQL.`);
    }
  }

  parse() {
    if (!this.tokens.length) {
      return null;
    }

    const expression = this.parseOr();

    if (this.current()) {
      throw new Error(`Unexpected token "${this.current()}" in JQL.`);
    }

    return expression;
  }

  parseOr() {
    let left = this.parseAnd();

    while (this.match('OR')) {
      left = {
        left,
        operator: 'OR',
        right: this.parseAnd(),
        type: 'logical',
      };
    }

    return left;
  }

  parseAnd() {
    let left = this.parseUnary();

    while (this.match('AND')) {
      left = {
        left,
        operator: 'AND',
        right: this.parseUnary(),
        type: 'logical',
      };
    }

    return left;
  }

  parseUnary() {
    if (this.match('NOT')) {
      return {
        expression: this.parseUnary(),
        type: 'not',
      };
    }

    if (this.match('(')) {
      const expression = this.parseOr();
      this.expect(')');
      return expression;
    }

    return this.parseComparison();
  }

  parseComparison() {
    const fieldToken = this.consume();

    if (!fieldToken) {
      throw new Error('Expected JQL field.');
    }

    const field = getCanonicalField(fieldToken);
    let operator = this.consume();

    if (!operator) {
      throw new Error(`Expected operator after "${fieldToken}".`);
    }

    operator = operator.toUpperCase();

    if (operator === 'NOT') {
      this.expect('IN');
      return {
        field,
        operator: 'NOT IN',
        type: 'comparison',
        values: this.parseListValue(),
      };
    }

    if (operator === 'IS') {
      const isNot = this.match('NOT');
      this.expect('EMPTY');

      return {
        field,
        operator: isNot ? 'IS NOT EMPTY' : 'IS EMPTY',
        type: 'comparison',
        values: [],
      };
    }

    if (operator === 'IN') {
      return {
        field,
        operator: 'IN',
        type: 'comparison',
        values: this.parseListValue(),
      };
    }

    if (!['=', '!=', '>', '<', '>=', '<=', '~'].includes(operator)) {
      throw new Error(`Unsupported JQL operator: ${operator}.`);
    }

    return {
      field,
      operator,
      type: 'comparison',
      values: [this.parseScalarValue()],
    };
  }

  parseListValue() {
    const values = [];

    this.expect('(');

    while (this.current()) {
      if (this.match(')')) {
        break;
      }

      values.push(this.parseScalarValue());

      if (this.match(',')) {
        continue;
      }

      this.expect(')');
      break;
    }

    if (!values.length) {
      throw new Error('IN operator requires at least one value.');
    }

    return values;
  }

  parseScalarValue() {
    const token = this.consume();

    if (!token) {
      throw new Error('Expected JQL value.');
    }

    if (['AND', 'OR', 'NOT', 'IN', 'IS', 'EMPTY'].includes(token.toUpperCase())) {
      throw new Error(`Expected JQL value, got "${token}".`);
    }

    return unquote(token);
  }
}

const parseJql = (jql = '') => {
  const tokens = tokenize(jql);
  const parser = new JqlParser(tokens);

  return parser.parse();
};

const createSqlBuilder = () => ({
  values: [],
  addValue(value) {
    this.values.push(value);
    return `$${this.values.length}`;
  },
});

const buildTextComparison = (expression, operator, values, builder) => {
  if (operator === 'IS EMPTY') {
    return `(${expression} IS NULL OR ${expression} = '')`;
  }

  if (operator === 'IS NOT EMPTY') {
    return `(${expression} IS NOT NULL AND ${expression} <> '')`;
  }

  if (operator === '~') {
    return `LOWER(COALESCE(${expression}, '')) LIKE LOWER(${builder.addValue(`%${values[0]}%`)})`;
  }

  if (operator === 'IN' || operator === 'NOT IN') {
    const placeholders = values.map((value) => builder.addValue(value));
    const sqlOperator = operator === 'IN' ? 'IN' : 'NOT IN';
    return `LOWER(COALESCE(${expression}, '')) ${sqlOperator} (${placeholders.map((placeholder) => `LOWER(${placeholder}::TEXT)`).join(', ')})`;
  }

  const comparisonOperator = operator === '!=' ? '<>' : operator;
  const placeholder = builder.addValue(values[0]);
  return `LOWER(COALESCE(${expression}, '')) ${comparisonOperator} LOWER(${placeholder}::TEXT)`;
};

const buildNumericComparison = (expression, operator, values, builder) => {
  if (operator === 'IS EMPTY') {
    return `${expression} IS NULL`;
  }

  if (operator === 'IS NOT EMPTY') {
    return `${expression} IS NOT NULL`;
  }

  if (operator === 'IN' || operator === 'NOT IN') {
    const numericValues = values.map((value) => normalizePositiveInteger(value));

    if (numericValues.some((value) => value === null)) {
      throw new Error('Numeric JQL fields require numeric values.');
    }

    const placeholder = builder.addValue(numericValues);
    return `${expression} ${operator === 'IN' ? '= ANY' : '<> ALL'}(${placeholder}::INTEGER[])`;
  }

  const numericValue = Number(values[0]);

  if (!Number.isFinite(numericValue)) {
    throw new Error('Numeric JQL fields require numeric values.');
  }

  const comparisonOperator = operator === '!=' ? '<>' : operator;
  return `${expression} ${comparisonOperator} ${builder.addValue(numericValue)}`;
};

const buildDateComparison = (expression, operator, values, builder) => {
  if (operator === 'IS EMPTY') {
    return `${expression} IS NULL`;
  }

  if (operator === 'IS NOT EMPTY') {
    return `${expression} IS NOT NULL`;
  }

  if (operator === 'IN' || operator === 'NOT IN') {
    const placeholders = values.map((value) => builder.addValue(value));
    const sqlOperator = operator === 'IN' ? 'IN' : 'NOT IN';
    return `${expression}::DATE ${sqlOperator} (${placeholders.map((placeholder) => `${placeholder}::DATE`).join(', ')})`;
  }

  const comparisonOperator = operator === '!=' ? '<>' : operator;
  return `${expression}::DATE ${comparisonOperator} ${builder.addValue(values[0])}::DATE`;
};

const buildUserComparison = (fieldName, operator, values, builder) => {
  if (operator === 'IS EMPTY') {
    return fieldName === 'assignee'
      ? '(t.assignee_id IS NULL AND NOT EXISTS (SELECT 1 FROM task_assignees ta_empty WHERE ta_empty.task_id = t.id))'
      : 't.creator_id IS NULL';
  }

  if (operator === 'IS NOT EMPTY') {
    return fieldName === 'assignee'
      ? '(t.assignee_id IS NOT NULL OR EXISTS (SELECT 1 FROM task_assignees ta_not_empty WHERE ta_not_empty.task_id = t.id))'
      : 't.creator_id IS NOT NULL';
  }

  const buildSingleUserCondition = (value) => {
    const numericValue = normalizePositiveInteger(value);

    if (numericValue) {
      const placeholder = builder.addValue(numericValue);

      if (fieldName === 'assignee') {
        return `(t.assignee_id = ${placeholder} OR EXISTS (SELECT 1 FROM task_assignees ta_user WHERE ta_user.task_id = t.id AND ta_user.user_id = ${placeholder}))`;
      }

      return `t.creator_id = ${placeholder}`;
    }

    const placeholder = builder.addValue(value);

    if (fieldName === 'assignee') {
      return `(
        LOWER(assignee.name) = LOWER(${placeholder}::TEXT)
        OR LOWER(assignee.email) = LOWER(${placeholder}::TEXT)
        OR EXISTS (
          SELECT 1
          FROM task_assignees ta_user
          INNER JOIN users assignee_user ON assignee_user.id = ta_user.user_id
          WHERE ta_user.task_id = t.id
            AND (LOWER(assignee_user.name) = LOWER(${placeholder}::TEXT) OR LOWER(assignee_user.email) = LOWER(${placeholder}::TEXT))
        )
      )`;
    }

    return `(LOWER(creator.name) = LOWER(${placeholder}::TEXT) OR LOWER(creator.email) = LOWER(${placeholder}::TEXT))`;
  };

  const positiveConditions = values.map(buildSingleUserCondition);
  const joinedCondition = positiveConditions.length === 1 ? positiveConditions[0] : `(${positiveConditions.join(' OR ')})`;

  if (operator === '!=' || operator === 'NOT IN') {
    return `NOT (${joinedCondition})`;
  }

  return joinedCondition;
};

const buildRelatedNameComparison = (config, operator, values, builder) => {
  const { emptySql, idExpression, nameExpression } = config;

  if (operator === 'IS EMPTY') {
    return emptySql;
  }

  if (operator === 'IS NOT EMPTY') {
    return `NOT (${emptySql})`;
  }

  const buildSingleCondition = (value) => {
    const numericValue = normalizePositiveInteger(value);

    if (numericValue) {
      return `${idExpression} = ${builder.addValue(numericValue)}`;
    }

    return `LOWER(${nameExpression}) = LOWER(${builder.addValue(value)}::TEXT)`;
  };

  const positiveConditions = values.map(buildSingleCondition);
  const joinedCondition = positiveConditions.length === 1 ? positiveConditions[0] : `(${positiveConditions.join(' OR ')})`;

  if (operator === '!=' || operator === 'NOT IN') {
    return `NOT (${joinedCondition})`;
  }

  return joinedCondition;
};

const buildExistsComparison = (config, operator, values, builder) => {
  const buildSingleExists = (value) => {
    const numericValue = normalizePositiveInteger(value);
    const valueCondition = numericValue
      ? `${config.idColumn} = ${builder.addValue(numericValue)}`
      : `LOWER(${config.nameColumn}) = LOWER(${builder.addValue(value)}::TEXT)`;

    return `EXISTS (${config.sql(valueCondition)})`;
  };

  if (operator === 'IS EMPTY') {
    return `NOT EXISTS (${config.sql('TRUE')})`;
  }

  if (operator === 'IS NOT EMPTY') {
    return `EXISTS (${config.sql('TRUE')})`;
  }

  const positiveConditions = values.map(buildSingleExists);
  const joinedCondition = positiveConditions.length === 1 ? positiveConditions[0] : `(${positiveConditions.join(' OR ')})`;

  if (operator === '!=' || operator === 'NOT IN') {
    return `NOT (${joinedCondition})`;
  }

  return joinedCondition;
};

const buildCustomFieldComparison = (fieldName, operator, values, builder) => {
  const fieldPlaceholder = builder.addValue(fieldName);

  if (operator === 'IS EMPTY') {
    return `NOT EXISTS (
      SELECT 1
      FROM custom_field_values cfv
      INNER JOIN custom_fields cf ON cf.id = cfv.custom_field_id
      WHERE cfv.issue_id = t.id
        AND LOWER(cf.name) = LOWER(${fieldPlaceholder}::TEXT)
        AND cfv.value IS NOT NULL
        AND cfv.value <> ''
    )`;
  }

  if (operator === 'IS NOT EMPTY') {
    return `EXISTS (
      SELECT 1
      FROM custom_field_values cfv
      INNER JOIN custom_fields cf ON cf.id = cfv.custom_field_id
      WHERE cfv.issue_id = t.id
        AND LOWER(cf.name) = LOWER(${fieldPlaceholder}::TEXT)
        AND cfv.value IS NOT NULL
        AND cfv.value <> ''
    )`;
  }

  const buildSingleCondition = (value) => {
    const placeholder = builder.addValue(operator === '~' ? `%${value}%` : value);
    const valueCondition = operator === '~'
      ? `LOWER(COALESCE(cfv.value, '')) LIKE LOWER(${placeholder}::TEXT)`
      : `LOWER(COALESCE(cfv.value, '')) = LOWER(${placeholder}::TEXT)`;

    return `EXISTS (
      SELECT 1
      FROM custom_field_values cfv
      INNER JOIN custom_fields cf ON cf.id = cfv.custom_field_id
      WHERE cfv.issue_id = t.id
        AND LOWER(cf.name) = LOWER(${fieldPlaceholder}::TEXT)
        AND ${valueCondition}
    )`;
  };

  const positiveConditions = values.map(buildSingleCondition);
  const joinedCondition = positiveConditions.length === 1 ? positiveConditions[0] : `(${positiveConditions.join(' OR ')})`;

  if (operator === '!=' || operator === 'NOT IN') {
    return `NOT (${joinedCondition})`;
  }

  return joinedCondition;
};

const buildIssueFullTextComparison = (operator, values, builder) => {
  if (operator !== '~') {
    return null;
  }

  const searchPlaceholder = builder.addValue(values[0]);
  const titleComparison = buildTextComparison('t.title', operator, values, builder);
  const descriptionComparison = buildTextComparison('t.description', operator, values, builder);

  return `(
    to_tsvector('simple', COALESCE(t.title, '') || ' ' || COALESCE(t.description, '')) @@ plainto_tsquery('simple', ${searchPlaceholder}::TEXT)
    OR ${titleComparison}
    OR ${descriptionComparison}
  )`;
};

const buildComparisonSql = (node, builder) => {
  const { field, operator, values } = node;

  if (field.name === 'custom_field') {
    return buildCustomFieldComparison(field.customFieldName, operator, values, builder);
  }

  if (['status', 'priority', 'resolution', 'issue_key', 'title', 'description'].includes(field.name)) {
    const expressionByField = {
      description: 't.description',
      issue_key: 't.issue_key',
      priority: 't.priority',
      resolution: 't.resolution',
      status: 't.status',
      title: 't.title',
    };

    return buildTextComparison(expressionByField[field.name], operator, values, builder);
  }

  if (field.name === 'text') {
    const fullTextComparison = buildIssueFullTextComparison(operator, values, builder);

    if (fullTextComparison) {
      return fullTextComparison;
    }

    return `(${buildTextComparison('t.title', operator, values, builder)} OR ${buildTextComparison('t.description', operator, values, builder)})`;
  }

  if (field.name === 'id' || field.name === 'story_points') {
    const expressionByField = {
      id: 't.id',
      story_points: 't.story_points',
    };

    return buildNumericComparison(expressionByField[field.name], operator, values, builder);
  }

  if (['created_at', 'updated_at', 'start_date', 'end_date'].includes(field.name)) {
    const expressionByField = {
      created_at: 't.created_at',
      end_date: 't.end_date',
      start_date: 't.start_date',
      updated_at: 't.updated_at',
    };

    return buildDateComparison(expressionByField[field.name], operator, values, builder);
  }

  if (field.name === 'assignee' || field.name === 'creator') {
    return buildUserComparison(field.name, operator, values, builder);
  }

  if (field.name === 'project') {
    if (operator === 'IS EMPTY') {
      return 't.project_id IS NULL';
    }

    if (operator === 'IS NOT EMPTY') {
      return 't.project_id IS NOT NULL';
    }

    const positiveConditions = values.map((value) => {
      const numericValue = normalizePositiveInteger(value);

      if (numericValue) {
        return `p.id = ${builder.addValue(numericValue)}`;
      }

      const placeholder = builder.addValue(value);
      const textOperator = operator === '~' ? 'LIKE' : '=';
      const normalizedValue = operator === '~' ? `%${value}%` : value;
      builder.values[builder.values.length - 1] = normalizedValue;

      return `(LOWER(p.name) ${textOperator} LOWER(${placeholder}::TEXT) OR LOWER(COALESCE(p.project_key, '')) ${textOperator} LOWER(${placeholder}::TEXT))`;
    });
    const joinedCondition = positiveConditions.length === 1 ? positiveConditions[0] : `(${positiveConditions.join(' OR ')})`;

    if (operator === '!=' || operator === 'NOT IN') {
      return `NOT (${joinedCondition})`;
    }

    return joinedCondition;
  }

  if (field.name === 'issue_type') {
    return buildRelatedNameComparison(
      {
        emptySql: 't.issue_type_id IS NULL',
        idExpression: 'issue_type.id',
        nameExpression: 'issue_type.name',
      },
      operator,
      values,
      builder,
    );
  }

  if (field.name === 'sprint') {
    return buildRelatedNameComparison(
      {
        emptySql: 't.sprint_id IS NULL',
        idExpression: 's.id',
        nameExpression: 's.name',
      },
      operator,
      values,
      builder,
    );
  }

  if (field.name === 'epic') {
    return buildRelatedNameComparison(
      {
        emptySql: 't.epic_id IS NULL',
        idExpression: 't.epic_id',
        nameExpression: 'COALESCE(epic.epic_name, \'\')',
      },
      operator,
      values,
      builder,
    );
  }

  if (field.name === 'component') {
    return buildExistsComparison(
      {
        idColumn: 'c.id',
        nameColumn: 'c.name',
        sql: (valueCondition) => `
          SELECT 1
          FROM issue_components ic
          INNER JOIN components c ON c.id = ic.component_id
          WHERE ic.issue_id = t.id
            AND ${valueCondition}
        `,
      },
      operator,
      values,
      builder,
    );
  }

  if (field.name === 'label') {
    return buildExistsComparison(
      {
        idColumn: 'tl.id',
        nameColumn: 'tl.name',
        sql: (valueCondition) => `
          SELECT 1
          FROM task_label_assignments tla
          INNER JOIN task_labels tl ON tl.id = tla.label_id
          WHERE tla.task_id = t.id
            AND ${valueCondition}
        `,
      },
      operator,
      values,
      builder,
    );
  }

  if (field.name === 'fix_version' || field.name === 'affects_version') {
    const tableName = field.name === 'fix_version' ? 'issue_fix_versions' : 'issue_affects_versions';
    return buildExistsComparison(
      {
        idColumn: 'r.id',
        nameColumn: 'r.name',
        sql: (valueCondition) => `
          SELECT 1
          FROM ${tableName} iv
          INNER JOIN releases r ON r.id = iv.release_id
          WHERE iv.issue_id = t.id
            AND ${valueCondition}
        `,
      },
      operator,
      values,
      builder,
    );
  }

  throw new Error(`Unsupported JQL field: ${field.name}.`);
};

const buildAstSql = (node, builder) => {
  if (!node) {
    return '';
  }

  if (node.type === 'logical') {
    return `(${buildAstSql(node.left, builder)} ${node.operator} ${buildAstSql(node.right, builder)})`;
  }

  if (node.type === 'not') {
    return `(NOT ${buildAstSql(node.expression, builder)})`;
  }

  return `(${buildComparisonSql(node, builder)})`;
};

const splitOrderClause = (jql = '') => {
  const match = jql.match(/\s+ORDER\s+BY\s+/i);

  if (!match) {
    return {
      orderClause: '',
      whereClause: jql.trim(),
    };
  }

  return {
    orderClause: jql.slice(match.index + match[0].length).trim(),
    whereClause: jql.slice(0, match.index).trim(),
  };
};

const buildOrderSql = (orderClause = '') => {
  if (!orderClause) {
    return 't.updated_at DESC, t.id DESC';
  }

  return orderClause.split(',').map((orderItem) => {
    const [rawField, rawDirection] = orderItem.trim().split(/\s+/);
    const field = ORDER_FIELDS[unquote(rawField || '').toLowerCase().replace(/[\s-]+/g, '_')];

    if (!field) {
      throw new Error(`Unsupported ORDER BY field: ${rawField}.`);
    }

    const direction = String(rawDirection || 'ASC').toUpperCase();

    if (!['ASC', 'DESC'].includes(direction)) {
      throw new Error('ORDER BY direction must be ASC or DESC.');
    }

    return `${field} ${direction}`;
  }).join(', ');
};

const buildJqlQuery = (jql = '', options = {}) => {
  const { orderClause, whereClause } = splitOrderClause(jql);
  const ast = parseJql(whereClause);
  const builder = createSqlBuilder();
  const conditions = ['t.deleted_at IS NULL'];
  const actorUserId = normalizePositiveInteger(options.actor_user_id || options.user_id);

  if (options.project_id || options.projectId) {
    conditions.push(`t.project_id = ${builder.addValue(normalizePositiveInteger(options.project_id || options.projectId))}`);
  }

  if (options.only_member_projects && actorUserId) {
    conditions.push(`(
      p.owner_id = ${builder.addValue(actorUserId)}
      OR EXISTS (
        SELECT 1
        FROM project_members pm
        WHERE pm.project_id = t.project_id
          AND pm.user_id = ${builder.addValue(actorUserId)}
      )
    )`);
  }

  if (ast) {
    conditions.push(buildAstSql(ast, builder));
  }

  return {
    orderSql: buildOrderSql(orderClause),
    parameters: builder.values,
    whereSql: conditions.join(' AND '),
  };
};

const searchIssues = async (jql = '', options = {}) => {
  const limit = normalizeLimit(options.limit);
  const offset = normalizeOffset(options.offset);
  const builtQuery = buildJqlQuery(jql, options);
  const countParameters = [...builtQuery.parameters];
  const listParameters = [...builtQuery.parameters, limit, offset];
  const limitPlaceholder = `$${listParameters.length - 1}`;
  const offsetPlaceholder = `$${listParameters.length}`;

  const [issuesResult, countResult] = await Promise.all([
    query(
      `
      ${ISSUE_SELECT}
      WHERE ${builtQuery.whereSql}
      ORDER BY ${builtQuery.orderSql}
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
      `,
      listParameters,
    ),
    query(
      `
      SELECT COUNT(*)::INTEGER AS total
      FROM tasks t
      INNER JOIN projects p ON p.id = t.project_id
      LEFT JOIN users assignee ON assignee.id = t.assignee_id
      LEFT JOIN users creator ON creator.id = t.creator_id
      LEFT JOIN issue_types issue_type ON issue_type.id = t.issue_type_id
      LEFT JOIN sprints s ON s.id = t.sprint_id
      LEFT JOIN epics epic ON epic.issue_id = t.epic_id
      LEFT JOIN workflow_states workflow_state ON workflow_state.id = t.workflow_state_id
      WHERE ${builtQuery.whereSql}
      `,
      countParameters,
    ),
  ]);

  return {
    issues: issuesResult.rows,
    limit,
    offset,
    total: Number(countResult.rows[0]?.total || 0),
  };
};

const validateJql = (jql = '') => {
  buildJqlQuery(jql);
  return true;
};

const getSavedFilterById = async (filterId) => {
  const result = await query(
    `
    SELECT
      id,
      user_id,
      name,
      description,
      jql_query,
      is_favorite,
      is_shared,
      created_at,
      updated_at
    FROM saved_filters
    WHERE id = $1
    `,
    [filterId],
  );

  return result.rows[0] || null;
};

const ensureFilterAccess = (filter, userId, action = 'read') => {
  const normalizedUserId = normalizePositiveInteger(userId);

  if (!filter) {
    throw new Error('Saved filter not found.');
  }

  if (Number(filter.user_id) === Number(normalizedUserId)) {
    return;
  }

  if (action === 'read' && filter.is_shared) {
    return;
  }

  throw new Error('You do not have access to this saved filter.');
};

const listSavedFilters = async (userId, filters = {}) => {
  const normalizedUserId = normalizePositiveInteger(userId);

  if (!normalizedUserId) {
    throw new Error('User login is required.');
  }

  const conditions = ['(sf.user_id = $1 OR sf.is_shared = TRUE)'];
  const values = [normalizedUserId];

  if (filters.favorite === 'true' || filters.is_favorite === 'true') {
    conditions.push('sf.is_favorite = TRUE');
  }

  const result = await query(
    `
    SELECT
      sf.id,
      sf.user_id,
      owner.name AS owner_name,
      sf.name,
      sf.description,
      sf.jql_query,
      sf.is_favorite,
      sf.is_shared,
      sf.created_at,
      sf.updated_at
    FROM saved_filters sf
    INNER JOIN users owner ON owner.id = sf.user_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY sf.is_favorite DESC, sf.updated_at DESC, sf.name ASC
    `,
    values,
  );

  return result.rows;
};

const createSavedFilter = async (payload = {}, context = {}) => {
  const userId = normalizePositiveInteger(context.actor_user_id || context.user_id || payload.user_id);

  if (!userId) {
    throw new Error('User login is required.');
  }

  if (!payload.name || !String(payload.name).trim()) {
    throw new Error('Filter name is required.');
  }

  if (!payload.jql_query && !payload.jql) {
    throw new Error('JQL query is required.');
  }

  const jqlQuery = String(payload.jql_query || payload.jql).trim();
  validateJql(jqlQuery);

  const result = await query(
    `
    INSERT INTO saved_filters (user_id, name, description, jql_query, is_favorite, is_shared)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [
      userId,
      String(payload.name).trim(),
      payload.description || null,
      jqlQuery,
      Boolean(payload.is_favorite || payload.isFavorite),
      Boolean(payload.is_shared || payload.isShared),
    ],
  );

  const savedFilter = result.rows[0];

  await logActivity({
    actor_user_id: userId,
    action: 'saved_filter.create',
    object_type: 'saved_filter',
    object_id: savedFilter.id,
    description: `Saved filter "${savedFilter.name}" created.`,
    metadata: {
      is_shared: savedFilter.is_shared,
      jql_query: savedFilter.jql_query,
    },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return savedFilter;
};

const updateSavedFilter = async (filterId, payload = {}, context = {}) => {
  const userId = normalizePositiveInteger(context.actor_user_id || context.user_id);
  const currentFilter = await getSavedFilterById(filterId);
  ensureFilterAccess(currentFilter, userId, 'update');

  const nextJql = payload.jql_query !== undefined || payload.jql !== undefined
    ? String(payload.jql_query || payload.jql).trim()
    : currentFilter.jql_query;

  validateJql(nextJql);

  const result = await query(
    `
    UPDATE saved_filters
    SET
      name = $1,
      description = $2,
      jql_query = $3,
      is_favorite = $4,
      is_shared = $5,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING *
    `,
    [
      payload.name === undefined ? currentFilter.name : String(payload.name).trim(),
      payload.description === undefined ? currentFilter.description : payload.description || null,
      nextJql,
      payload.is_favorite === undefined && payload.isFavorite === undefined
        ? currentFilter.is_favorite
        : Boolean(payload.is_favorite || payload.isFavorite),
      payload.is_shared === undefined && payload.isShared === undefined
        ? currentFilter.is_shared
        : Boolean(payload.is_shared || payload.isShared),
      filterId,
    ],
  );

  const savedFilter = result.rows[0];

  await logActivity({
    actor_user_id: userId,
    action: 'saved_filter.update',
    object_type: 'saved_filter',
    object_id: savedFilter.id,
    description: `Saved filter "${savedFilter.name}" updated.`,
    metadata: {
      is_shared: savedFilter.is_shared,
      jql_query: savedFilter.jql_query,
    },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return savedFilter;
};

const deleteSavedFilter = async (filterId, context = {}) => {
  const userId = normalizePositiveInteger(context.actor_user_id || context.user_id);
  const currentFilter = await getSavedFilterById(filterId);
  ensureFilterAccess(currentFilter, userId, 'delete');

  await query('DELETE FROM saved_filters WHERE id = $1', [filterId]);

  await logActivity({
    actor_user_id: userId,
    action: 'saved_filter.delete',
    object_type: 'saved_filter',
    object_id: Number(filterId),
    description: `Saved filter "${currentFilter.name}" deleted.`,
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return {
    deleted_filter_id: Number(filterId),
  };
};

const executeSavedFilter = async (filterId, options = {}) => {
  const filter = await getSavedFilterById(filterId);
  ensureFilterAccess(filter, options.actor_user_id || options.user_id, 'read');

  const result = await searchIssues(filter.jql_query, options);

  return {
    filter,
    ...result,
  };
};

module.exports = {
  buildJqlQuery,
  createSavedFilter,
  deleteSavedFilter,
  executeSavedFilter,
  getSavedFilterById,
  listSavedFilters,
  parseJql,
  searchIssues,
  updateSavedFilter,
  validateJql,
};
