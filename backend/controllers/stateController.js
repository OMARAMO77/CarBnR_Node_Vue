// controllers/stateController.js
const State = require('../models/State');
const { Parser } = require('json2csv');
const archiver = require('archiver');
const moment = require('moment');


const handleErrors = (res, error, defaultMessage) => {
  console.error(error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({ error: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ error: 'State name already exists' });
  }
  res.status(500).json({ error: defaultMessage });
};

// Get all states with search
const getStates = async (req, res) => {
  try {
    const { 
      search,
      sort = 'name_asc',
      page = 1,
      limit = 10,
      createdAfter,
      createdBefore
    } = req.query;

    // Build query
    const query = {};
    
    // Search filter
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Date filters
    if (createdAfter) {
      query.createdAt = { ...query.createdAt, $gte: new Date(createdAfter) };
    }
    if (createdBefore) {
      query.createdAt = { ...query.createdAt, $lte: new Date(createdBefore) };
    }

    // Sorting
    const sortOptions = {
      'name_asc': { name: 1 },
      'name_desc': { name: -1 },
      'date_asc': { createdAt: 1 },
      'date_desc': { createdAt: -1 }
    };
    const sortOrder = sortOptions[sort] || sortOptions.name_asc;

    // Pagination
    const pageNumber = parseInt(page);
    const limitNumber = Math.min(parseInt(limit), 100);
    const skip = (pageNumber - 1) * limitNumber;

    // Get results
    const [states, total] = await Promise.all([
      State.find(query)
        .sort(sortOrder)
        .skip(skip)
        .limit(limitNumber),
      State.countDocuments(query)
    ]);

    res.json({
      data: states,
      meta: {
        total,
        pages: Math.ceil(total / limitNumber),
        page: pageNumber,
        limit: limitNumber
      }
    });
  } catch (err) {
    handleErrors(res, err, 'Failed to fetch states');
  }
};
// Get single state by ID
const getStateById = async (req, res) => {
  try {
    const state = await State.findById(req.params.id);
    if (!state) return res.status(404).json({ error: 'State not found' });
    res.json(state);
  } catch (err) {
    handleErrors(res, err, 'Failed to fetch state');
  }
};

// Create state
const createState = async (req, res) => {
  try {
    const state = new State(req.body);
    await state.save();
    res.status(201).json(state);
  } catch (err) {
    handleErrors(res, err, 'Failed to create state');
  }
};

// Update state
const updateState = async (req, res) => {
  try {
    const updatedState = await State.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).orFail();
    
    res.json(updatedState);
  } catch (err) {
    handleErrors(res, err, 'Failed to update state');
  }
};

// Delete state
const deleteState = async (req, res) => {
  try {
    const deletedState = await State.findByIdAndDelete(req.params.id);
    if (!deletedState) return res.status(404).json({ error: 'State not found' });
    res.status(204).send();
  } catch (err) {
    handleErrors(res, err, 'Failed to delete state');
  }
};
// Full-text search
const searchStates = async (req, res) => {
  try {
    const query = req.params.query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const states = await State.find({
      name: { $regex: query, $options: 'i' }
    });
    res.json(states);
  } catch (err) {
    handleErrors(res, err, 'Search failed');
  }
};

// Autocomplete suggestions
const autocompleteStates = async (req, res) => {
  try {
    const prefix = req.params.prefix.toLowerCase();
    const states = await State.find({
      name: { $regex: `^${prefix}`, $options: 'i' }
    }).limit(10);
    
    res.json(states.map(s => s.name));
  } catch (err) {
    handleErrors(res, err, 'Autocomplete failed');
  }
};
// Bulk import
const bulkImportStates = async (req, res) => {
  try {
    const states = req.body.map(name => ({ name }));
    const result = await State.insertMany(states, {
      ordered: false,
      rawResult: true
    });

    const inserted = result.insertedCount;
    const duplicates = result.getWriteErrors().length;

    res.status(201).json({
      success: true,
      inserted,
      duplicates,
      duplicatesList: duplicates > 0 
        ? result.getWriteErrors().map(e => e.err.op.name)
        : []
    });
  } catch (err) {
    if (err.name === 'MongoBulkWriteError') {
      const inserted = err.insertedCount;
      const duplicates = err.writeErrors.length;
      
      return res.status(207).json({ // 207 Multi-Status
        success: true,
        inserted,
        duplicates,
        duplicatesList: duplicates > 0 
          ? err.writeErrors.map(e => e.err.op.name)
          : []
      });
    }
    handleErrors(res, err, 'Bulk import failed');
  }
};
// Bulk export
const bulkExportStates = async (req, res) => {
  try {
    const { 
      format = 'json',
      createdAfter,
      createdBefore,
      compress 
    } = req.query;

    // Build query
    const query = {};
    if (createdAfter || createdBefore) {
      query.createdAt = {};
      if (createdAfter) query.createdAt.$gte = new Date(createdAfter);
      if (createdBefore) query.createdAt.$lte = new Date(createdBefore);
    }

    // Get data
    const states = await State.find(query).lean();

    // Response configuration
    const timestamp = moment().format('YYYYMMDD_HHmmss');
    const filenameBase = `states_export_${timestamp}`;
    
    if (compress === 'true') {
      return handleCompressedExport(res, states, format, filenameBase);
    }

    return handleDirectExport(res, states, format, filenameBase);
  } catch (err) {
    handleErrors(res, err, 'Export failed');
  }
};

// Helper functions
const handleDirectExport = (res, data, format, filenameBase) => {
  if (format === 'csv') {
    const parser = new Parser();
    const csv = parser.parse(data);
    
    res
      .set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=${filenameBase}.csv`
      })
      .send(csv);
  } else {
    res
      .set({
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename=${filenameBase}.json`
      })
      .send(JSON.stringify(data, null, 2));
  }
};

const handleCompressedExport = (res, data, format, filenameBase) => {
  const archive = archiver('zip', { zlib: { level: 9 }});
  const extension = format === 'csv' ? 'csv' : 'json';
  
  res
    .set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename=${filenameBase}.zip`
    });

  archive.pipe(res);

  if (format === 'csv') {
    const parser = new Parser();
    const csv = parser.parse(data);
    archive.append(csv, { name: `${filenameBase}.csv` });
  } else {
    archive.append(JSON.stringify(data, null, 2), { name: `${filenameBase}.json` });
  }

  archive.finalize();
};
module.exports = {
  getStates,
  getStateById,
  createState,
  updateState,
  deleteState,
  searchStates,
  autocompleteStates,
  bulkImportStates,
  bulkExportStates
};
