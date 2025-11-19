import Hundel from '../models/Hundel.js';
import { logAudit } from '../utils/audit.js';

// Create a new hundel
export const createHundel = async (req, res) => {
  try {
    const { name, description, status, metadata } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const h = new Hundel({ name, description, status, metadata });
    const saved = await h.save();
    await logAudit(req, 'create', 'Hundel', saved._id, null, saved.toObject());
    res.status(201).json(saved);
  } catch (err) {
    console.error('createHundel', err);
    res.status(500).json({ message: 'Failed to create Hundel' });
  }
};

// Get list of hundels (with optional status filter)
export const getHundels = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const list = await Hundel.find(filter).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    console.error('getHundels', err);
    res.status(500).json({ message: 'Failed to fetch Hundels' });
  }
};

// Get a single hundel by id
export const getHundelById = async (req, res) => {
  try {
    const { id } = req.params;
    const h = await Hundel.findById(id);
    if (!h) return res.status(404).json({ message: 'Hundel not found' });
    res.json(h);
  } catch (err) {
    console.error('getHundelById', err);
    res.status(500).json({ message: 'Failed to fetch Hundel' });
  }
};

// Update hundel
export const updateHundel = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updated = await Hundel.findByIdAndUpdate(id, updates, { new: true });
    if (!updated) return res.status(404).json({ message: 'Hundel not found' });
    await logAudit(req, 'update', 'Hundel', updated._id, null, updated.toObject());
    res.json(updated);
  } catch (err) {
    console.error('updateHundel', err);
    res.status(500).json({ message: 'Failed to update Hundel' });
  }
};

// Delete hundel
export const deleteHundel = async (req, res) => {
  try {
    const { id } = req.params;
    const removed = await Hundel.findByIdAndDelete(id);
    if (!removed) return res.status(404).json({ message: 'Hundel not found' });
    await logAudit(req, 'delete', 'Hundel', removed._id, removed.toObject(), null);
    res.json({ message: 'Deleted', id: removed._id });
  } catch (err) {
    console.error('deleteHundel', err);
    res.status(500).json({ message: 'Failed to delete Hundel' });
  }
};
