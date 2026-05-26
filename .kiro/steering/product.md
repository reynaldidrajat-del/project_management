# Product Overview

## Project Management Planner with Gantt

A full-stack project management application based on Microsoft Planner-style workflow with automatic Gantt chart generation.

## Core Concept

- **Daily workflow**: Users manage work through a Planner-like Board View with drag-and-drop
- **Unified data model**: Same task data powers Board, List/Table, and Gantt views
- **Automatic Gantt**: Timeline visualization is generated automatically from task data
- **Cross-department projects**: Projects are workspaces that span multiple departments
- **Multi-level monitoring**: 
  - Project-level Gantt for individual projects
  - Department-level Gantt combining all projects involving department users

## Key Features

- **Task Management**: Nested subtasks with unlimited depth, drag-and-drop between buckets/statuses
- **Progress Tracking**: Automatic parent task progress calculation from children
- **Approval Workflow**: Tasks enter "Waiting Review" at 100%, require lead/super admin approval
- **Working Calendar**: Configurable holidays and working days, automatic work-day calculations
- **Real-time Collaboration**: Socket.io for live updates
- **Role-Based Access**: Super admin, admin, member, viewer roles with permission system
- **Multi-tenant**: Departments, locations/business units, cross-department project membership

## User Roles

- **Super Admin**: Can approve any task, full system access
- **Admin**: Department/project management capabilities
- **Member**: Task creation and management
- **Viewer**: Read-only access

## Default Credentials

All users default to password: `modern888` (change before production)
