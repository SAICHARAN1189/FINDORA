// src/pages/dashboard/CreateReportPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { ArrowLeft } from 'lucide-react';
import { CATEGORIES } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function CreateReportPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'lost',
    category: 'electronics',
    title: '',
    description: '',
    brand: '',
    model: '',
    color: '',
    locationName: '',
    dateOccurred: new Date().toISOString().split('T')[0],
    identifyingCharacteristics: '',
    imageUrl: '',
    anonymous: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        type: formData.type,
        category: formData.category,
        title: formData.title,
        description: formData.description,
        brand: formData.brand || null,
        model: formData.model || null,
        color: formData.color || null,
        location: formData.locationName
          ? { name: formData.locationName, lat: 12.9716, lng: 77.5946 }
          : null,
        dateOccurred: formData.dateOccurred
          ? new Date(formData.dateOccurred).toISOString()
          : new Date().toISOString(),
        identifyingCharacteristics: formData.identifyingCharacteristics || null,
        imageUrl: formData.imageUrl || `https://placehold.co/400x300/3b82f6/ffffff?text=${encodeURIComponent(formData.title)}`,
        anonymous: formData.anonymous,
      };

      await reportsAPI.create(payload);
      toast.success('Report created successfully! AI is analyzing for matches...');
      navigate('/reports');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/reports')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Report</h1>
          <p className="text-gray-600">Report a lost or found item</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Report Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Type */}
            <Select
              label="Report Type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
              options={[
                { value: 'lost', label: '🔴 Lost - I lost an item' },
                { value: 'found', label: '🟢 Found - I found an item' },
              ]}
            />

            {/* Category */}
            <Select
              label="Category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              options={CATEGORIES.map((c) => ({
                value: c.value,
                label: `${c.icon} ${c.label}`,
              }))}
            />

            {/* Title */}
            <Input
              label="Title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., iPhone 15 Pro, Black Backpack"
              required
            />

            {/* Description */}
            <Textarea
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Provide a detailed description..."
              rows={4}
              required
            />

            {/* Brand */}
            <Input
              label="Brand"
              name="brand"
              value={formData.brand}
              onChange={handleChange}
              placeholder="e.g., Apple, Nike, Samsung"
            />

            {/* Model */}
            <Input
              label="Model"
              name="model"
              value={formData.model}
              onChange={handleChange}
              placeholder="e.g., iPhone 15 Pro, Galaxy S24"
            />

            {/* Color */}
            <Input
              label="Color"
              name="color"
              value={formData.color}
              onChange={handleChange}
              placeholder="e.g., Black, Blue, Red"
            />

            {/* Location */}
            <Input
              label="Location"
              name="locationName"
              value={formData.locationName}
              onChange={handleChange}
              placeholder="e.g., Central Library, Food Court"
            />

            {/* Date */}
            <Input
              label="Date Occurred"
              name="dateOccurred"
              type="date"
              value={formData.dateOccurred}
              onChange={handleChange}
            />

            {/* Identifying Characteristics */}
            <Textarea
              label="Identifying Characteristics"
              name="identifyingCharacteristics"
              value={formData.identifyingCharacteristics}
              onChange={handleChange}
              placeholder="Unique features, scratches, stickers, serial numbers..."
              rows={3}
            />

            {/* Image URL */}
            <Input
              label="Image URL (Optional)"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
              placeholder="https://example.com/image.jpg"
            />

            {/* Anonymous */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="anonymous"
                name="anonymous"
                checked={formData.anonymous}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="anonymous" className="text-sm text-gray-700">
                Report anonymously (hide my identity from others)
              </label>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button type="submit" loading={loading} className="flex-1">
                Create Report
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/reports')}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
